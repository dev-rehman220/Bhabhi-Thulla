import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const googleWebClientId = (globalThis as any)?.process?.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

GoogleSignin.configure({
  webClientId: googleWebClientId,
});

export class FirebaseService {
  static async signInWithGoogle(): Promise<FirebaseAuthTypes.User> {
    await GoogleSignin.hasPlayServices();
    const signInRes: any = await GoogleSignin.signIn();
    const idToken = signInRes.idToken ?? signInRes;
    const credential = auth.GoogleAuthProvider.credential(idToken as string);
    const { user } = await auth().signInWithCredential(credential);
    await FirebaseService.ensureUserDocument(user);
    return user;
  }

  static async signInAsGuest(): Promise<FirebaseAuthTypes.User> {
    const { user } = await auth().signInAnonymously();
    await FirebaseService.ensureUserDocument(user);
    return user;
  }

  static async signOut() {
    await auth().signOut();
  }

  static async getIdToken(): Promise<string> {
    return auth().currentUser?.getIdToken() ?? '';
  }

  static async ensureUserDocument(user: FirebaseAuthTypes.User) {
    const ref = firestore().collection('users').doc(user.uid);
    const doc = await ref.get();

    if (!doc.exists) {
      await ref.set({
        displayName: user.displayName ?? `Guest_${user.uid.slice(0, 6)}`,
        avatarUrl: user.photoURL ?? '',
        coins: 1000,
        xp: 0,
        rank: 'bronze',
        totalGames: 0,
        wins: 0,
        thullaCount: 0,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  static async updateUserStats(uid: string, won: boolean, isThulla: boolean) {
    const ref = firestore().collection('users').doc(uid);
    await ref.update({
      totalGames: firestore.FieldValue.increment(1),
      wins: firestore.FieldValue.increment(won ? 1 : 0),
      thullaCount: firestore.FieldValue.increment(isThulla ? 1 : 0),
      xp: firestore.FieldValue.increment(won ? 100 : 10),
      coins: firestore.FieldValue.increment(won ? 200 : 50),
    });
  }

  static async getLeaderboard(limit = 20) {
    const snap = await firestore()
      .collection('users')
      .orderBy('xp', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
      id: d.id,
      ...d.data(),
    }));
  }
}
