import firebase from 'firebase'

const apikey = process.env.REACT_APP_FIREBASE_API_KEY;
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


