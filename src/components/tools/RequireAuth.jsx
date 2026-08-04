import React from 'react';

const RequireAuth = ({ user, login, children }) => {
    if (user) return children;
    return (
        <div className="text-center" style={{ marginTop: 60 }}>
            <h3>Login required</h3>
            <p>Please log in to use this tool.</p>
            <button className="btn btn-outline-primary" onClick={login}>Login</button>
        </div>
    );
};

export default RequireAuth;
