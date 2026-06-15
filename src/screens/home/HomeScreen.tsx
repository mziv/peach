import React, { useCallback, useRef, useState } from "react";
import {
	View,
	Text,
	FlatList,
	TouchableOpacity,
	ActivityIndicator,
	RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { getFriendships } from "../../services/friendships";
import { getViewedMap, hasNewActivity } from "../../services/viewedFriends";
import { HomeStackParamList } from "../../navigation/HomeStack";
import UserPreview from "../../components/UserPreview";

type HomeNav = NativeStackNavigationProp<HomeStackParamList, "Home">;

interface FriendWithMeta {
	uid: string;
	displayName: string;
	username: string;
	photoURL?: string;
	lastPostText: string;
	lastPostAt: Date | null;
	hasNewActivity: boolean;
}

interface SelfMeta {
	lastPostText: string;
	lastPostAt: Date | null;
}

export function HomeScreen() {
	const navigation = useNavigation<HomeNav>();
	const { user } = useAuth();
	const [friends, setFriends] = useState<FriendWithMeta[]>([]);
	const [selfMeta, setSelfMeta] = useState<SelfMeta>({
		lastPostText: "",
		lastPostAt: null,
	});
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	// Friends opened this session, with the local time we opened them. Used to
	// clear the dot instantly on tap and to keep it cleared while the
	// server-side `lastViewedAt` write propagates — without permanently
	// suppressing dots if the friend posts again later.
	const viewedThisSession = useRef<Map<string, Date>>(new Map());

	const loadData = useCallback(async () => {
		if (!user) return;

		// Fetch self meta
		const selfMetaSnap = await getDoc(
			doc(db, "users", user.uid, "meta", "meta"),
		);
		const selfMetaData = selfMetaSnap.exists() ? selfMetaSnap.data() : null;

		setSelfMeta({
			lastPostText: selfMetaData?.lastPostText ?? "",
			lastPostAt: selfMetaData?.lastPostAt?.toDate() ?? null,
		});

		// Fetch friendships and friend meta
		const friendships = await getFriendships(user.uid);
		const viewedMap = await getViewedMap(user.uid);

		const friendUids = friendships.map((f) =>
			f.requesterId === user.uid ? f.receiverId : f.requesterId,
		);

		const friendsWithMeta: FriendWithMeta[] = [];
		for (const friendUid of friendUids) {
			const userSnap = await getDoc(doc(db, "users", friendUid));
			const metaSnap = await getDoc(
				doc(db, "users", friendUid, "meta", "meta"),
			);

			if (userSnap.exists()) {
				const userData = userSnap.data();
				const metaData = metaSnap.exists() ? metaSnap.data() : null;
				const friendLastPostAt = metaData?.lastPostAt?.toDate() ?? null;
				// Use whichever view is more recent: the server-recorded
				// `lastViewedAt` or an optimistic local stamp from tapping
				// the friend this session (covers the propagation gap).
				let effectiveViewed = viewedMap[friendUid];
				const localViewed = viewedThisSession.current.get(friendUid);
				if (
					localViewed &&
					(!(effectiveViewed instanceof Date) ||
						localViewed > effectiveViewed)
				) {
					effectiveViewed = localViewed;
				}
				friendsWithMeta.push({
					uid: friendUid,
					displayName: userData.displayName,
					username: userData.username,
					photoURL: userData.photoURL,
					lastPostText: metaData?.lastPostText ?? "",
					lastPostAt: friendLastPostAt,
					hasNewActivity: hasNewActivity(friendLastPostAt, effectiveViewed),
				});
			}
		}

		friendsWithMeta.sort((a, b) => {
			if (!a.lastPostAt && !b.lastPostAt) return 0;
			if (!a.lastPostAt) return 1;
			if (!b.lastPostAt) return -1;
			return b.lastPostAt.getTime() - a.lastPostAt.getTime();
		});

		setFriends(friendsWithMeta);
		setLoading(false);
	}, [user]);

	useFocusEffect(
		useCallback(() => {
			loadData();
		}, [loadData]),
	);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadData();
		} finally {
			setRefreshing(false);
		}
	}, [loadData]);

	function handleFriendPress(item: FriendWithMeta) {
		// Opening the friend's page marks it viewed: record the local time and
		// clear the dot now so it doesn't linger while the page loads and the
		// focus reload runs.
		viewedThisSession.current.set(item.uid, new Date());
		setFriends((prev) =>
			prev.map((f) =>
				f.uid === item.uid ? { ...f, hasNewActivity: false } : f,
			),
		);
		navigation.navigate("FriendPage", {
			friendUid: item.uid,
			friendDisplayName: item.displayName,
			friendUsername: item.username,
			friendPhotoURL: item.photoURL,
		});
	}

	if (loading) {
		return (
			<View className="flex-1 justify-center items-center bg-white">
				<ActivityIndicator size="large" />
			</View>
		);
	}

	return (
		<View className="flex-1 bg-white">
			<FlatList
				data={friends}
				keyExtractor={(item) => item.uid}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
				ListHeaderComponent={
					<>
						{/* Self-preview row */}
						<UserPreview
							displayName={user?.displayName ?? ""}
							username={user?.username ?? ""}
							photoURL={user?.photoURL}
							previewText={selfMeta.lastPostText || "No posts yet"}
							timestamp={selfMeta.lastPostAt}
							onPress={() => navigation.navigate("MyPage")}
						/>

						{/* Add Friend button */}
						<TouchableOpacity
							className="bg-green rounded-full py-3 mx-4 my-3 items-center"
							onPress={() => navigation.navigate("SearchUsers")}
						>
							<Text className="text-white font-semibold">
								Add Friend...
							</Text>
						</TouchableOpacity>
					</>
				}
				renderItem={({ item }) => (
					<UserPreview
						displayName={item.displayName}
						photoURL={item.photoURL}
						username={item.username}
						previewText={item.lastPostText || "No posts yet"}
						timestamp={item.lastPostAt}
						hasNewActivity={item.hasNewActivity}
						onPress={() => handleFriendPress(item)}
					/>
				)}
				ListEmptyComponent={
					<View className="flex-1 justify-center items-center p-6">
						<Text className="text-sm text-gray-400">
							No friends yet. Tap "Add Friend..." to find people!
						</Text>
					</View>
				}
			/>
		</View>
	);
}
