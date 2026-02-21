import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const apikey = import.meta.env.VITE_FIREBASE_API_KEY;

// if the api key is not set, throw an error
if (!apikey) {
    throw new Error('Firebase API key is not set. Please set the VITE_FIREBASE_API_KEY environment variable.');
}
const config = {
    apiKey: apikey,
    authDomain: "thedavidhanks-559b0.firebaseapp.com",
    databaseURL: "https://thedavidhanks-559b0.firebaseio.com/",
    projectId: "thedavidhanks-559b0",
};
firebase.initializeApp(config);

export const provider = new firebase.auth.GoogleAuthProvider();
export const db = firebase.firestore();
export const auth = firebase.auth();
export default firebase;


