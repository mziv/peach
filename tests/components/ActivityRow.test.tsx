import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ActivityRow from "../../src/components/ActivityRow";
import { Notification } from "../../src/types";

const baseNotif: Notification = {
  notifId: "n-1",
  type: "like",
  actorUid: "a-1",
  actorUsername: "bob",
  actorDisplayName: "Bob Jones",
  postId: "p-1",
  postOwnerUid: "o-1",
  postTextPreview: "my great post",
  createdAt: new Date(),
};

describe("ActivityRow", () => {
  it("renders the actor name and 'liked your post' for a like", () => {
    const { getByText } = render(
      <ActivityRow notification={baseNotif} onPress={() => {}} />
    );
    expect(getByText("Bob Jones")).toBeTruthy();
    expect(getByText("liked your post")).toBeTruthy();
    expect(getByText("my great post")).toBeTruthy();
  });

  it("renders the comment text for a comment", () => {
    const { getByText } = render(
      <ActivityRow
        notification={{ ...baseNotif, type: "comment", commentText: "love this" }}
        onPress={() => {}}
      />
    );
    expect(getByText("commented on your post")).toBeTruthy();
    expect(getByText("love this")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ActivityRow notification={baseNotif} onPress={onPress} />
    );
    fireEvent.press(getByText("Bob Jones"));
    expect(onPress).toHaveBeenCalled();
  });
});
