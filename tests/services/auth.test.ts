import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { setDoc, getDocs, query, collection, where } from "firebase/firestore";
import {
  signUp,
  logIn,
  logOut,
  reauthenticate,
  deleteAuthAccount,
} from "../../src/services/auth";
import { auth, db } from "../../src/config/firebase";

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  EmailAuthProvider: { credential: jest.fn(() => "mock-credential") },
  reauthenticateWithCredential: jest.fn(),
  deleteUser: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  collection: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
  db: {},
}));

describe("auth service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("signUp", () => {
    it("creates a Firebase Auth user and Firestore user doc", async () => {
      (getDocs as jest.Mock).mockResolvedValue({ empty: true });
      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: { uid: "uid-123" },
      });
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      await signUp("test@example.com", "password123", "testuser", "Test User");

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        "test@example.com",
        "password123"
      );
      expect(setDoc).toHaveBeenCalled();
    });

    it("throws if username is already taken", async () => {
      (getDocs as jest.Mock).mockResolvedValue({ empty: false });

      await expect(
        signUp("test@example.com", "password123", "taken", "Test User")
      ).rejects.toThrow("Username is already taken");
    });
  });

  describe("logIn", () => {
    it("signs in with email and password", async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: { uid: "uid-123" },
      });

      await logIn("test@example.com", "password123");

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        "test@example.com",
        "password123"
      );
    });
  });

  describe("logOut", () => {
    it("signs out the current user", async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);

      await logOut();

      expect(signOut).toHaveBeenCalledWith(auth);
    });
  });

  describe("reauthenticate", () => {
    it("reauthenticates the current user with an email credential", async () => {
      (auth as any).currentUser = { uid: "uid-1", email: "a@b.com" };
      (reauthenticateWithCredential as jest.Mock).mockResolvedValue(undefined);

      await reauthenticate("secret");

      expect(EmailAuthProvider.credential).toHaveBeenCalledWith("a@b.com", "secret");
      expect(reauthenticateWithCredential).toHaveBeenCalledWith(
        auth.currentUser,
        "mock-credential"
      );
    });

    it("throws when there is no current user", async () => {
      (auth as any).currentUser = null;
      await expect(reauthenticate("secret")).rejects.toThrow(
        "No authenticated user to re-authenticate"
      );
    });

    it("throws when the current user has no email", async () => {
      (auth as any).currentUser = { uid: "uid-1", email: null };
      await expect(reauthenticate("secret")).rejects.toThrow(
        "No authenticated user to re-authenticate"
      );
    });
  });

  describe("deleteAuthAccount", () => {
    it("deletes the current Firebase Auth user", async () => {
      (auth as any).currentUser = { uid: "uid-1", email: "a@b.com" };
      (deleteUser as jest.Mock).mockResolvedValue(undefined);

      await deleteAuthAccount();

      expect(deleteUser).toHaveBeenCalledWith(auth.currentUser);
    });

    it("propagates requires-recent-login, then succeeds after reauth + retry", async () => {
      (auth as any).currentUser = { uid: "uid-1", email: "a@b.com" };
      (deleteUser as jest.Mock)
        .mockRejectedValueOnce({ code: "auth/requires-recent-login" })
        .mockResolvedValueOnce(undefined);
      (reauthenticateWithCredential as jest.Mock).mockResolvedValue(undefined);

      await expect(deleteAuthAccount()).rejects.toMatchObject({
        code: "auth/requires-recent-login",
      });
      await reauthenticate("secret");
      expect(reauthenticateWithCredential).toHaveBeenCalledTimes(1);
      await expect(deleteAuthAccount()).resolves.toBeUndefined();
    });
  });
});
