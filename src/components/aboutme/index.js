import React, {useState, useEffect}  from 'react';
import Select from 'react-select';

const socialBlock = {
    fontSize: "48px", 
    margin: "5px"
};
const AboutMe = () => {
    const skillscategories = [
        {value: 'developer', label: 'developer'},
        {value: 'ide', label: 'ide'},
        {value: 'vcs', label: 'vcs'},
        {value: 'language', label: 'progamming languages'},
        // {value: 'cad', label: 'CAD'},
        // {value: 'analysis', label: 'analysis'},
        {value: 'jslibraries', label: 'Libraries'},
        {value: 'gameDesign', label: 'Game Design'}
    ]

    const [skills, setSkills] = useState(skillscategories);
    const [skillsDOM, setSkillsDOM] = useState();
    useEffect( () =>{
        if(skillsDOM){

            //reset all children to dimished class
            [...skillsDOM.children].forEach( child =>{
                child.classList.remove("highlightSkill");
                child.classList.add("diminishSkill");
            });

            //only highlight selected.
            if(skills){
                skills.forEach( skill =>{
                    [...skillsDOM.children].forEach( child =>{
                        if(child.classList.contains(skill.value)){
                            child.classList.add("highlightSkill");
                            child.classList.remove("diminishSkill");
                        }
                    });
                })
            }
            
        }else{
            //The DOM doesn't exist yet.
        }
    }, [skills, skillsDOM]);

    const updateSkills = (value) => {
        setSkills(value);
    }
    
    return (
        <div className="resume">
            <div className="row">
                <div className="col-md-8 ">
                    <h3>Greetings! I'm David Hanks.</h3>
                    <p>I'm an engineer and developer with a passion for pushing boundaries and embracing diverse challenges.  I bring a unique blend of mechanical engineering and software development.</p>
                    <p>I earned my stripes at the Georgia Institute of Technology, graduating with a Masters degree in Computer Science. My journey began in 2002 when I obtained a BS in Mechanical Engineering from the University of Louisiana. Over the years, I've honed my skills in the oil and gas industry, specializing in the development and maintenance of critical product lines such as tongs/slips, blow-out preventers, and supporting controls.</p>
                    <p>My professional trajectory has granted me a comprehensive understanding of the product life cycle, from collaborative specification development with customers to on-site equipment installations. I thrive in dynamic environments, consistently delivering innovative solutions and leveraging my expertise in drawing creation, load analysis, test design, and execution.</p>
                    <p>In recent years, I've expanded my horizons into the realm of software and electronics. Fueled by an innate curiosity and a desire to stay at the forefront of technology, I dived into online courses to refresh my skills in HTML, CSS, and Javascript. At the local makerspace, I delved into DC circuits, embracing hands-on learning experiences. The advent of open-source boards like Arduino captivated me, prompting a deeper exploration of this evolving landscape.</p>
                    <p>In 2019, I embarked on a new chapter by enrolling in a Computer Science Master's program at Georgia Tech. The curriculum has exposed me to a diverse range of topics, from Operating Systems and Computer Networks to Software Development, Embedded Systems Optimizations, Game Design, and Game AI. Currently gearing up for my Spring 2023 course, "Machine Learning for Trading," I am eager to unravel the possibilities that lie ahead.</p>
                    <p>Beyond my professional pursuits, I am an avid climber, ultimate freesbier, video gamer, and Eagle Scout. My love for exploration extends to my travels, and I take pride in being a native Cajun and devoted husband.</p>
                    <p>As I continue to evolve professionally and personally, I am excited about the prospect of leveraging my multifaceted skills and experiences to contribute to innovative projects. I am eager to connect with like-minded professionals and explore opportunities that align with my passion for technology, problem-solving, and continuous growth. Let's build something extraordinary together!</p>
                    <h3>My journey with computing</h3>
                    <p>My programming journey began in the early '90s with BASIC on my Apple IIgs. My father introduced me to the world of coding through paperbound books with sample programs, from calculators to choose-your-own adventures. Despite the challenges of saving work to a 5.25" floppy disk, the process taught me programming logic and debugging - foundational skills that have stayed with me.</p>
                    <p>Building on this foundation, I delved into Pascal in high school and later explored Visual Basic in college. I set up LANs in various environments, from my college fraternity house to every home I've lived in, fostering my interest in networking. My early ventures into web development involved creating a PHP photo album and a phpBB forum for my family.</p>
                    <p>During a year of travel in 2004, I crafted a PHP website to showcase my experiences, demonstrating my commitment to combining technology with personal projects. Though these early works are lost to the digital ether, the lessons learned were invaluable.</p>
                    <p>Fast forward to today, and my projects are centered around web and mobile application development in React within the AWS and Firebase infrastructure. 
                        I've established margeeanddave.com to document our travels across the US. Currently, I'm diving into React-Native, working on a mobile app to assist 
                        climbers in geo-tagging their photos for discovering rock climbing locations.</p>
                    <p>This journey reflects my continuous passion for technology and showcases my evolution from early coding experiences to contemporary web and mobile development projects. I am excited about the prospect of applying these skills and experiences to contribute to innovative and challenging projects in a professional setting. Let's connect and explore the possibilities together!</p>
                </div>
                <div className="col-md-4 certificates resumeBorder">
                <div className="socialDiv">
                        <a className="fa fa-linkedin-square" style={socialBlock} href="https://www.linkedin.com/in/thedavidhanks" target="_blank" rel="noopener noreferrer"> </a>
                        <a className="fa fa-github-square"  style={socialBlock} href="https://github.com/thedavidhanks/" target="_blank" rel="noopener noreferrer"> </a>
                        <a className="fa fa-facebook-square" style={socialBlock} href="https://www.facebook.com/david.hanks" target="_blank" rel="noopener noreferrer"> </a>
                    </div>
                    <h5>Resumes</h5>
                    <ul>
                        <li><a href="https://tdh-public-files.s3.us-east-2.amazonaws.com/resume/SoftwareDeveloper.pdf" target="_blank" rel="noopener noreferrer">Software Developer</a></li>
                        <li><a href="https://tdh-public-files.s3.us-east-2.amazonaws.com/resume/SeniorMechanicalEngineer.pdf" target="_blank" rel="noopener noreferrer">Sr. Mechanical Engineer</a></li>
                    </ul>
                    <h5>Certificates</h5>
                    <ul>
                        <li><a href="https://pels.texas.gov/roster/pesearch.html?ver=V110722" target="_blank" rel="noopener noreferrer">P.E. (104644)</a></li>
                        <li>Eagle Scout</li>
                    </ul>
                    <h5>Coursework</h5>
                    <ul>
                    <li><a href="https://omscs.gatech.edu/cs-7632-game-ai" target="_blank" rel="noopener noreferrer" title="Artifical Intelligence in video games.">Game AI</a></li>
                        <li><a href="https://omscs.gatech.edu/cs-7646-machine-learning-trading" target="_blank" rel="noopener noreferrer" title="Probabilistic machine learning approaches (linear regression, Q-Learning, KNN, and regression trees)for trading decisions.">ML for Trading</a></li>
                        <li><a href="https://omscs.gatech.edu/cs-6250-computer-networks" target="_blank" rel="noopener noreferrer" title="routing, SDN, BGP hijacking, and Internet measurements.">Computer Networks</a></li>
                        <li><a href="https://omscs.gatech.edu/cs-6291-embedded-systems-optimization" target="_blank" rel="noopener noreferrer" title="Focus on optimizing software for hardware with embedded ARM processors.">Embedded System Optimization</a></li>
                        <li><a href="https://omscs.gatech.edu/cs-6310-software-architecture-design" target="_blank" rel="noopener noreferrer">Software Design and Arch</a></li>
                        <li><a href="https://omscs.gatech.edu/cs-6200-introduction-operating-systems" target="_blank" rel="noopener noreferrer" title="The practical component of the course teaches multithread programming, inter-process communication, and distributed interactions via RPC.">Operating Systems</a></li>
                        <li><a href="https://omscs.gatech.edu/cs-6515-intro-graduate-algorithms" target="_blank" rel="noopener noreferrer" title="The main topics covered in the course include: dynamic programming; divide and conquer, including FFT; randomized algorithms, including RSA cryptosystem;  graph algorithms; max-flow algorithms; linear programming; and NP-completeness.">Graduate Algorthms</a></li>
                        <li><a href="https://omscs.gatech.edu/cs-6300-software-development-process" target="_blank" rel="noopener noreferrer">Software Dev Process</a></li>
                        <li><a href="https://omscs.gatech.edu/cs-6457-video-game-design" target="_blank" rel="noopener noreferrer" title="Game design in Unity and C#">Video Game Design</a></li>
                        <li><a 
                                href="https://www.udemy.com/certificate/UC-0bda0691-7c4b-466f-a5fe-b5a171594b7a/?utm_medium=email&utm_campaign=email&utm_source=sendgrid.com" 
                                target="_blank" 
                                rel="noopener noreferrer"
                            >
                            AWS CCP training
                            </a>
                        </li>
                        <li><a href="https://www.udemy.com/certificate/UC-U878XCQQ/" target="_blank" rel="noopener noreferrer">React/Redux</a></li>
                        <li><a href="https://www.udacity.com/course/java-programming-basics--ud282?utm_campaign=android_pathway&utm_medium=referral&utm_source=aws_s3_pdf" target="_blank" rel="noopener noreferrer">Java</a></li>
                        <li><a href="https://courses.edx.org/certificates/5906b12c3b864b4a9301b1b02d2f867f" target="_blank" rel="noopener noreferrer">jQuery</a></li>
                        <li><a href="https://www.udemy.com/certificate/UC-Z2FTY4VS/" target="_blank" rel="noopener noreferrer">Git</a></li>
                        <li><a href="https://courses.edx.org/certificates/1a98e664ec694a7ea85a5a9117548ac0" target="_blank" rel="noopener noreferrer">HTML/CSS</a></li>
                    </ul>
                    <h5>Skills</h5>
                    <Select 
                        options={skillscategories}
                        isMulti
                        defaultValue={skills}
                        name="skills"
                        onChange={updateSkills}
                    />
                    <div id="skillList" ref={(skillsList) => { setSkillsDOM(skillsList)}}>
                        <span className="cad ">Solidworks, </span>
                        <span className="cad ">AutoCAD, </span>
                        <span className="cad ">Fusion360, </span>
                        <span className="cad ">Inventor,  </span>
                        <span className="cad ">Pro/E, </span>
                        <span className="analysis ">Ansys, </span>
                        <span className="gameDesign">Unity, </span>
                        <span className="cad">Blender, </span>
                        <span className="ide developer ">Visual Studio Code, </span>
                        <span className="ide developer ">Visual Studio, </span>
                        <span className="ide developer ">NetBeans, </span>
                        <span className="vcs developer ">git, </span>
                        <span className="vcs developer ">GitHub, </span>
                        <span className="language developer ">Python, </span>
                        <span className="language developer ">C, </span>
                        <span className="language developer ">C++, </span>
                        <span className="language developer ">Java, </span>
                        <span className="language developer ">javascript, </span>
                        <span className="language developer ">NodeJS, </span>
                        <span className="jslibraries developer ">ReactJS, </span>
                        <span className="jslibraries developer ">Leaflet, </span>
                        <span className="jslibraries developer ">Bootstrap, </span>
                        <span className="mechanical">hydraulics, </span>
                        <span className="mechanical">structural analysis</span>
                    </div>
                </div>    
            </div>
        </div>
                
    );
} 
export default AboutMe;