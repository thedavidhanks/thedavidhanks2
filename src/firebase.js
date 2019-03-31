import firebase from 'firebase'

const apikey = process.env.REACT_APP_FIREBASE_API_KEY;
console.log(process.env);
const config = {
    apiKey: apikey,
    authDomain: "thedavidhanks-559b0.firebaseapp.com",
    databaseURL: "https://thedavidhanks-559b0.firebaseio.com/",
    projectId: "thedavidhanks-559b0",
    storageBucket: "gs://thedavidhanks-559b0.appspot.com/"
};
firebase.initializeApp(config);

export const provider = new firebase.auth.GoogleAuthProvider();
export const auth = firebase.auth();
export default firebase;


