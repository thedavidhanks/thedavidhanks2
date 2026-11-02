import React from 'react';
import { Link } from 'react-router-dom';

export const RESUME_SOFTWARE = 'https://tdh-public-files.s3.us-east-2.amazonaws.com/resume/SoftwareDeveloper.pdf';
export const RESUME_MECHANICAL = 'https://tdh-public-files.s3.us-east-2.amazonaws.com/resume/SeniorMechanicalEngineer.pdf';

// The recruiter-facing landing page. The long-form story lives on /about.
const Home = () => {
    return (
        <div className="home">
            <h1>David Hanks</h1>
            <p className="lead mb-2">Software developer and licensed mechanical engineer (P.E.)</p>
            <p className="prose">
                I build web and mobile apps with React, AWS and Firebase, backed by 20+ years
                engineering oil and gas equipment: blow-out preventers, tongs/slips and their controls.
            </p>

            {/* The PDFs open in the same tab: the link text doesn't promise a new one. */}
            <a className="btn btn-primary btn-lg" href={RESUME_SOFTWARE} rel="noopener noreferrer">
                Download resume (Software Developer)
            </a>
            <ul className="list-unstyled d-flex flex-wrap column-gap-3 row-gap-1 mt-3">
                <li><a href={RESUME_MECHANICAL} rel="noopener noreferrer">Mechanical engineering resume</a></li>
                <li><a href="https://www.linkedin.com/in/thedavidhanks" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
                <li><a href="https://github.com/thedavidhanks/" target="_blank" rel="noopener noreferrer">GitHub</a></li>
                <li><a href="mailto:dphanks@gmail.com">Email</a></li>
                <li><Link to="/askme">Ask me anything</Link></li>
            </ul>

            <h2 className="visually-hidden">Background</h2>
            <ul className="prose">
                <li>M.S. Computer Science, Georgia Tech (Dec 2023)</li>
                <li>B.S. Mechanical Engineering, University of Louisiana (2002) · Texas P.E. #104644</li>
                <li>20+ years across the full product life cycle, from customer specs to drawings, load analysis, test design and on-site installation</li>
                <li>Python · C/C++ · Java · JavaScript/Node · React · AWS · Firebase · SolidWorks · AutoCAD · Ansys</li>
            </ul>

            <p className="prose">
                Climber, ultimate player, Eagle Scout, native Cajun. Coding since BASIC on an Apple IIgs.{' '}
                <Link to="/about">More about me <span aria-hidden="true">→</span></Link>
            </p>
        </div>
    );
};

export default Home;
