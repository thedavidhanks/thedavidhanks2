import React from 'react';

const RequireAuth = ({ user, login, children }) => {
    // toollist.jsx stores pre-constructed elements with no props, so a gated
    // tool cannot otherwise see who is signed in. The gate already has the
    // user, so hand it down. Preferred over reading auth.currentUser inside
    // the tool, which races with auth hydration and bypasses App's user state.
    if (user) return React.cloneElement(children, { user });
    return (
        <div className="text-center" style={{ marginTop: 60 }}>
            <h3>Login required</h3>
            <p>Please log in to use this tool.</p>
            <button className="btn btn-outline-primary" onClick={login}>Login</button>
        </div>
    );
};

export default RequireAuth;
