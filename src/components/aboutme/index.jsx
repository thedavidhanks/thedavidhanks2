import React from 'react';

import PageMeta from '../PageMeta.jsx';
import { pageTitle } from '../../seo.js';

// Descriptions used to live in title tooltips, which touch and keyboard users
// never see; they are rendered as visible text now.
const coursework = [
    { title: 'Game AI', href: 'https://omscs.gatech.edu/cs-7632-game-ai', description: 'Artificial intelligence in video games.' },
    { title: 'ML for Trading', href: 'https://omscs.gatech.edu/cs-7646-machine-learning-trading', description: 'Probabilistic machine learning approaches (linear regression, Q-Learning, KNN, and regression trees) for trading decisions.' },
    { title: 'Computer Networks', href: 'https://omscs.gatech.edu/cs-6250-computer-networks', description: 'Routing, SDN, BGP hijacking, and Internet measurements.' },
    { title: 'Embedded System Optimization', href: 'https://omscs.gatech.edu/cs-6291-embedded-systems-optimization', description: 'Focus on optimizing software for hardware with embedded ARM processors.' },
    { title: 'Software Design and Arch', href: 'https://omscs.gatech.edu/cs-6310-software-architecture-design' },
    { title: 'Operating Systems', href: 'https://omscs.gatech.edu/cs-6200-introduction-operating-systems', description: 'The practical component of the course teaches multithread programming, inter-process communication, and distributed interactions via RPC.' },
    { title: 'Graduate Algorithms', href: 'https://omscs.gatech.edu/cs-6515-intro-graduate-algorithms', description: 'The main topics covered in the course include: dynamic programming; divide and conquer, including FFT; randomized algorithms, including RSA cryptosystem; graph algorithms; max-flow algorithms; linear programming; and NP-completeness.' },
    { title: 'Software Dev Process', href: 'https://omscs.gatech.edu/cs-6300-software-development-process' },
    { title: 'Video Game Design', href: 'https://omscs.gatech.edu/cs-6457-video-game-design', description: 'Game design in Unity and C#' },
    { title: 'AWS CCP training', href: 'https://www.udemy.com/certificate/UC-0bda0691-7c4b-466f-a5fe-b5a171594b7a/?utm_medium=email&utm_campaign=email&utm_source=sendgrid.com' },
    { title: 'AWS Cloud Quest: Cloud Practitioner', href: 'https://www.credly.com/badges/6daffe4b-72ee-4e4d-ba31-3a0e8acbffdf/public_url' },
    { title: 'React/Redux', href: 'https://www.udemy.com/certificate/UC-U878XCQQ/' },
    { title: 'Java', href: 'https://www.udacity.com/course/java-programming-basics--ud282?utm_campaign=android_pathway&utm_medium=referral&utm_source=aws_s3_pdf' },
    { title: 'jQuery', href: 'https://courses.edx.org/certificates/5906b12c3b864b4a9301b1b02d2f867f' },
    { title: 'Git', href: 'https://www.udemy.com/certificate/UC-Z2FTY4VS/' },
    { title: 'HTML/CSS', href: 'https://courses.edx.org/certificates/1a98e664ec694a7ea85a5a9117548ac0' },
];

// A static list, every skill at the same size. It replaces a react-select
// filter whose CAD/analysis categories were commented out, which left those
// skills permanently shrunk to ~10px.
const skillGroups = [
    { name: 'Languages', skills: ['Python', 'C', 'C++', 'Java', 'JavaScript', 'NodeJS'] },
    { name: 'Web & cloud', skills: ['ReactJS', 'Leaflet', 'Bootstrap', 'Drupal', 'Django', 'LAMP', 'Salesforce (LWC, Apex)', 'AWS', 'GCP', 'Firebase', 'PythonAnywhere', 'DNS'] },
    { name: 'Engineering & CAD', skills: ['Solidworks', 'AutoCAD', 'Fusion360', 'Inventor', 'Pro/E', 'Ansys', 'hydraulics', 'structural analysis'] },
    { name: 'Tools', skills: ['Visual Studio Code', 'Visual Studio', 'NetBeans', 'git', 'GitHub', 'Unity', 'Blender'] },
];

const AboutMe = () => {
    return (
        <div className="resume">
            <PageMeta
                title={pageTitle('About')}
                description="How David Hanks went from 20+ years engineering oil and gas equipment to a Georgia Tech CS master's and software development, plus skills and coursework."
                path="/about"
            />
            <h1>About David Hanks</h1>
            <div className="row">
                <div className="col-md-8 prose">
                    <p className="lead">I'm a software developer and a licensed mechanical engineer.</p>
                    <p>I earned a B.S. in Mechanical Engineering from the University of Louisiana in 2002 and spent more than 20 years engineering oil and gas equipment. At Frank's Casing I was a mechanical engineer working on power tongs and slips. At Hydril / GE (mechanical engineer, lead mechanical engineer and field engineer), Oceaneering (senior mechanical engineer) and Offshore Technical Solutions (principal engineer) I worked on blow-out preventers, their controls and BOP shear reports. Across those roles I covered the full product life cycle, from writing specifications with customers through drawings, load analysis and test design to installing equipment on site. I'm a licensed Professional Engineer in Texas (#104644).</p>
                    <p>Alongside that work I went back to software and electronics. I took online courses in HTML, CSS and JavaScript, learned DC circuits at a local makerspace, and built projects on Arduino boards.</p>
                    <p>In 2019 I enrolled in Georgia Tech's M.S. in Computer Science program and graduated in December 2023. My coursework included operating systems, computer networks, embedded systems optimization, graduate algorithms, game AI and machine learning for trading.</p>
                    <p>I'm a software engineer at Rice University, where I work across Rice's stacks, including Drupal, Django, LAMP and Salesforce (LWC and Apex), host applications on-premises and in the cloud (AWS, GCP, PythonAnywhere and Salesforce), and manage DNS records, among other things.</p>
                    <p>In my own projects I use React, AWS and Firebase. I built margeeanddave.com to document our travels across the US, and a React Native app that helps climbers geo-tag their photos to find rock climbing locations; it reached a development release on Google Play before I paused it.</p>
                    <p>Outside work I'm a climber, an ultimate frisbee player and a video gamer, an Eagle Scout and a native Cajun. I've been programming since BASIC on an Apple IIgs.</p>
                    <p>Want to talk? Email me at <a href="mailto:dphanks@gmail.com">dphanks@gmail.com</a>.</p>
                </div>
                <div className="col-md-4 certificates resumeBorder">
                    <h2 className="h5">Certificates</h2>
                    <ul>
                        <li><a href="https://pels.texas.gov/roster/pesearch.html?ver=V110722" target="_blank" rel="noopener noreferrer">P.E. (104644)</a></li>
                        <li>Eagle Scout</li>
                    </ul>
                    <h2 className="h5">Coursework</h2>
                    <ul>
                        {coursework.map((course) => (
                            <li key={course.href}>
                                <a href={course.href} target="_blank" rel="noopener noreferrer">{course.title}</a>
                                {course.description && <div className="small text-body-secondary">{course.description}</div>}
                            </li>
                        ))}
                    </ul>
                    <h2 className="h5">Skills</h2>
                    {skillGroups.map((group) => (
                        <React.Fragment key={group.name}>
                            <h3 className="h6 mb-1">{group.name}</h3>
                            <p>{group.skills.join(', ')}</p>
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};
export default AboutMe;
