import React from 'react';

const ResumeCompany = (props) => {
    return (
            <div className="resumeCo">
                <span className="resumeCoName">{props.company}</span>, <span className="resumeDates">{props.start} - {props.end}</span>
                {props.children}    
            </div>
            
    );
};

export default ResumeCompany;
