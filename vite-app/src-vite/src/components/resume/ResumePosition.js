import React from 'react';

const ResumePosition = (props) => {
    return (
            <div>
                <div className="resumePosition">{props.title}</div>
                {props.children}    
            </div>
            
    );
};

export default ResumePosition;
