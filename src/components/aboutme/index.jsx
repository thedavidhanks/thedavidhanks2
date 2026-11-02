import React from 'react';

// Descriptions used to live in title tooltips, which touch and keyboard users
// never see; they are rendered as visible text now.
const coursework = [
    { title: 'Game AI', href: 'https://omscs.gatech.edu/cs-7632-game-ai', description: 'Artifical Intelligence in video games.' },
    { title: 'ML for Trading', href: 'https://omscs.gatech.edu/cs-7646-machine-learning-trading', description: 'Probabilistic machine learning approaches (linear regression, Q-Learning, KNN, and regression trees)for trading decisions.' },
    { title: 'Computer Networks', href: 'https://omscs.gatech.edu/cs-6250-computer-networks', description: 'routing, SDN, BGP hijacking, and Internet measurements.' },
    { title: 'Embedded System Optimization', href: 'https://omscs.gatech.edu/cs-6291-embedded-systems-optimization', description: 'Focus on optimizing software for hardware with embedded ARM processors.' },
    { title: 'Software Design and Arch', href: 'https://omscs.gatech.edu/cs-6310-software-architecture-design' },
    { title: 'Operating Systems', href: 'https://omscs.gatech.edu/cs-6200-introduction-operating-systems', description: 'The practical component of the course teaches multithread programming, inter-process communication, and distributed interactions via RPC.' },
    { title: 'Graduate Algorthms', href: 'https://omscs.gatech.edu/cs-6515-intro-graduate-algorithms', description: 'The main topics covered in the course include: dynamic programming; divide and conquer, including FFT; randomized algorithms, including RSA cryptosystem;  graph algorithms; max-flow algorithms; linear programming; and NP-completeness.' },
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
    { name: 'Web & cloud', skills: ['ReactJS', 'Leaflet', 'Bootstrap', 'AWS', 'Firebase'] },
    { name: 'Engineering & CAD', skills: ['Solidworks', 'AutoCAD', 'Fusion360', 'Inventor', 'Pro/E', 'Ansys', 'hydraulics', 'structural analysis'] },
    { name: 'Tools', skills: ['Visual Studio Code', 'Visual Studio', 'NetBeans', 'git', 'GitHub', 'Unity', 'Blender'] },
];

const AboutMe = () => {
    return (
        <div className="resume">
            <h1>About David Hanks</h1>
            <div className="row">
                <div className="col-md-8 prose">
                    <p className="lead">Greetings! I'm David Hanks.</p>
                    <p>I'm an engineer and developer with a passion for pushing boundaries and embracing diverse challenges.  I bring a unique blend of mechanical engineering and software development.</p>
                    <p>I earned my stripes at the Georgia Institute of Technology, graduating with a Masters degree in Computer Science. My journey began in 2002 when I obtained a BS in Mechanical Engineering from the University of Louisiana. Over the years, I've honed my skills in the oil and gas industry, specializing in the development and maintenance of critical product lines such as tongs/slips, blow-out preventers, and supporting controls.</p>
                    <p>My professional trajectory has granted me a comprehensive understanding of the product life cycle, from collaborative specification development with customers to on-site equipment installations. I thrive in dynamic environments, consistently delivering innovative solutions and leveraging my expertise in drawing creation, load analysis, test design, and execution.</p>
                    <p>In recent years, I've expanded my horizons into the realm of software and electronics. Fueled by an innate curiosity and a desire to stay at the forefront of technology, I dove into online courses to refresh my skills in HTML, CSS, and Javascript. At the local makerspace, I delved into DC circuits, embracing hands-on learning experiences. The advent of open-source boards like Arduino captivated me, prompting a deeper exploration of this evolving landscape.</p>
                    <p>In 2019, I embarked on a new chapter by enrolling in a Computer Science Master's program at Georgia Tech. The curriculum has exposed me to a diverse range of topics, from Operating Systems and Computer Networks to Software Development, Embedded Systems Optimizations, Game Design, and Game AI. Currently gearing up for my Spring 2023 course, "Machine Learning for Trading," I am eager to unravel the possibilities that lie ahead.</p>
                    <p>Beyond my professional pursuits, I am an avid climber, ultimate freesbier, video gamer, and Eagle Scout. My love for exploration extends to my travels, and I take pride in being a native Cajun and devoted husband.</p>
                    <p>As I continue to evolve professionally and personally, I am excited about the prospect of leveraging my multifaceted skills and experiences to contribute to innovative projects. I am eager to connect with like-minded professionals and explore opportunities that align with my passion for technology, problem-solving, and continuous growth. Let's build something extraordinary together!</p>
                    <h2 className="h3">My journey with computing</h2>
                    <p>My programming journey began in the early '90s with BASIC on my Apple IIgs. My father introduced me to the world of coding through paperbound books with sample programs, from calculators to choose-your-own adventures. Despite the challenges of saving work to a 5.25" floppy disk, the process taught me programming logic and debugging - foundational skills that have stayed with me.</p>
                    <p>Building on this foundation, I delved into Pascal in high school and later explored Visual Basic in college. I set up LANs in various environments, from my college fraternity house to every home I've lived in, fostering my interest in networking. My early ventures into web development involved creating a PHP photo album and a phpBB forum for my family.</p>
                    <p>During a year of travel in 2004, I crafted a PHP website to showcase my experiences, demonstrating my commitment to combining technology with personal projects. Though these early works are lost to the digital ether, the lessons learned were invaluable.</p>
                    <p>Fast forward to today, and my projects are centered around web and mobile application development in React within the AWS and Firebase infrastructure. 
                        I've established margeeanddave.com to document our travels across the US. Currently, I'm diving into React-Native, working on a mobile app to assist 
                        climbers in geo-tagging their photos for discovering rock climbing locations.</p>
                    <p>This journey reflects my continuous passion for technology and showcases my evolution from early coding experiences to contemporary web and mobile development projects. I am excited about the prospect of applying these skills and experiences to contribute to innovative and challenging projects in a professional setting. Let's connect and explore the possibilities together!</p>
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
