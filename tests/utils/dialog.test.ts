let mockOS = "ios";

jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockOS;
    },
  },
  Alert: {
    alert: jest.fn(),
  },
}));

import { Alert } from "react-native";
import { confirmDestructive, notify } from "../../src/utils/dialog";

describe("dialog helpers", () => {
  afterEach(() => {
    jest.resetAllMocks();
    delete (global as any).window;
  });

  describe("confirmDestructive on web (Alert.alert is a no-op in react-native-web)", () => {
    beforeEach(() => {
      mockOS = "web";
    });

    it("uses the browser confirm and resolves true when accepted", async () => {
      const confirmMock = jest.fn().mockReturnValue(true);
      (global as any).window = { confirm: confirmMock };

      await expect(
        confirmDestructive("Delete post", "Are you sure?")
      ).resolves.toBe(true);
      expect(confirmMock).toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it("resolves false when the browser confirm is dismissed", async () => {
      (global as any).window = { confirm: jest.fn().mockReturnValue(false) };

      await expect(
        confirmDestructive("Delete post", "Are you sure?")
      ).resolves.toBe(false);
    });
  });

  describe("confirmDestructive on native", () => {
    beforeEach(() => {
      mockOS = "ios";
    });

    it("resolves true when the destructive button is pressed", async () => {
      (Alert.alert as jest.Mock).mockImplementation((_t, _m, buttons) => {
        buttons.find((b: any) => b.style === "destructive").onPress();
      });

      await expect(
        confirmDestructive("Delete post", "Are you sure?")
      ).resolves.toBe(true);
    });

    it("resolves false when the cancel button is pressed", async () => {
      (Alert.alert as jest.Mock).mockImplementation((_t, _m, buttons) => {
        buttons.find((b: any) => b.style === "cancel").onPress();
      });

      await expect(
        confirmDestructive("Delete post", "Are you sure?")
      ).resolves.toBe(false);
    });
  });

  describe("notify", () => {
    it("uses window.alert on web", () => {
      mockOS = "web";
      const alertMock = jest.fn();
      (global as any).window = { alert: alertMock };

      notify("Error", "Something broke");

      expect(alertMock).toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it("uses Alert.alert on native", () => {
      mockOS = "ios";

      notify("Error", "Something broke");

      expect(Alert.alert).toHaveBeenCalledWith("Error", "Something broke");
    });
  });
});
