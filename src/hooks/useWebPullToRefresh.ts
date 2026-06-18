import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import PullToRefresh from "pulltorefreshjs";

/**
 * Adds pull-to-refresh on web (e.g. iPhone Safari), where it is otherwise
 * missing: react-native-web's <RefreshControl> renders the indicator but never
 * wires the pull-down gesture to onRefresh, so pulling does nothing. This hook
 * attaches pulltorefreshjs to the list's underlying scroll element to supply
 * that gesture. On native it is a no-op and the real <RefreshControl> handles
 * the pull as usual.
 *
 * Pass the same ref you give the FlatList/SectionList (we read its DOM scroll
 * node via getScrollableNode) and the same onRefresh handler.
 */
export function useWebPullToRefresh(
  // FlatList/SectionList both expose getScrollableNode; React Native types it as
  // returning a native node tag (number), but on web it returns the DOM element
  // we need, so we accept it loosely and narrow below.
  listRef: React.RefObject<{ getScrollableNode?: () => unknown } | null>,
  onRefresh: () => Promise<void> | void,
) {
  // Hold the latest callback in a ref so the gesture is initialised exactly
  // once on mount instead of being torn down and rebuilt on every render (the
  // caller's onRefresh need not be memoised).
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const node = listRef.current?.getScrollableNode?.() as
      | HTMLElement
      | undefined;
    if (!node) return;

    const instance = PullToRefresh.init({
      // pulltorefreshjs's types only declare string selectors, but at runtime
      // any non-string value is used as the element directly (see its source),
      // which lets us target react-native-web's generated scroll node.
      mainElement: node as unknown as string,
      triggerElement: node as unknown as string,
      // Only arm the gesture at the very top of the list, otherwise a normal
      // upward scroll back to the top would trigger an unwanted refresh.
      shouldPullToRefresh: () => node.scrollTop <= 0,
      onRefresh: () => onRefreshRef.current(),
      instructionsPullToRefresh: "Pull to refresh",
      instructionsReleaseToRefresh: "Release to refresh",
      instructionsRefreshing: "Refreshing…",
    });

    return () => instance.destroy();
    // listRef is stable across renders; onRefresh is read through the ref above.
  }, [listRef]);
}
