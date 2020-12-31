import React, {useState, useEffect}  from 'react';
import Card from 'react-bootstrap/Card';
import Accordian from 'react-bootstrap/Accordion';
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
        {value: 'language', label: 'progamming language'},
        {value: 'cad', label: 'CAD'},
        {value: 'analysis', label: 'analysis'},
        {value: 'jslibraries', label: 'Libraries'}
    ]

    const [skills, setSkills] = useState(skillscategories);
    const [skillsDOM, setSkillsDOM] = useState();
    useEffect( () =>{
        if(skillsDOM){

            //reset all children to dimished clash
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
                    <h2>About me.</h2>
                    <p>I'm an engineer, developer, tinkerer, climber, ultimate freesbier, video gamer, eagle scout, traveller, native Cajun and husband.  
                        In November of 2020, my wife and I moved to Chattanooga from Houston with the hopes of making it a permanent stay.</p>
                    <p>In 2002 I graduated from the University of Louisiana with a BS in Mechanical Engineering. I've spent the
                         majority of my career developing and maintaining oil and gas product lines.  Specifically, I've worked on tongs/slips, blow-out preventers, and supporting
                         controls.  I've been able to experince the full range of product life cycle: from developing a specification with a customer, through creating/reviewing 
                         drawings, analyizing loads, writing and conducting tests, and installing equipment on-site.</p>
                    <p>In more recent years, I've turned my attention to software and electronics.  I've always had an interest in computers, but around 2010 I really started to 
                        explore new (at least to me) technologies.  I took online courses to reintroduce myself to updated HTML/CSS/Javascript. I signed up for 
                        a DC circuits course a the local makerspace. I explored open source boards like the Arduino which had not been around when I was in school.  Ultimately in 2019, I 
                        enrolled in a Computer Science Master's program at Georgia Tech.  So far I've taken courses on Operting Systems, Computer Networks, & Software 
                        Development.   I'm excited to see where this new interests takes me.  
                    </p>
                    <h3>Computers and me</h3>
                    <p>My first experience programming was with BASIC on my Apple IIgs in the early 90s.  My father had brought home paperbound books with sample code that you would
                        copy into the terminal.  They were small programs: calculators, choose your own adventures, tic-tac-toe; but they were fun and engaging.  I remember not knowing how to 
                        save the work I had done to a 5.25" floppy, so I had to enter sometimes 20 pages of code in one sitting to see the program in action.  It was fun and tedious work.
                        The exercise taught me programming logic and debuggings among other things.
                        </p>
                    <p>After that start, I took Pascal in high school, then some Visual Basic in college.  I setup a phoneline LAN in my college fraternity house, and some
                        form of hardwired LAN in every home since. I learned how to setup my home computer to host a hacky PHP photo album
                        and a phpBB forum for my family.  In 2004, when I took a year to travel, I made another PHP website to show my pictures.  Sadly, these works are lost to 
                        the ether(net).  Version control systems were not widespread and I had no knowledge of them at the time.
                    </p>
                    <p>These days, my projects lean more towards web development in React within the AWS cloud infastructure.  I 
                        created <a href="margeeanddave.com" target="_blank" rel="noopner noreferrer">margeeanddave.com</a> to track our travels 
                        across the US.  The next software project I'm tinkering with is a mobile app that allows neighbors to share produce with each other.</p>
                    <h3>These are the FAQs:</h3>
                    <Accordian>
                        <Card>
                            <Accordian.Toggle as={Card.Header} eventKey="0">
                                Are you an experienced developer?
                            </Accordian.Toggle>
                            <Accordian.Collapse eventKey="0">
                                <Card.Body>
                                <p>Ok, you got me.  Athough I have developed a few pieces of software for work,  I haven't technically been part of a production development environment.  My 
                                skills may not appear as refined on paper, but I'm likely as savy as the next guy and way more cool.  You might be interested to know:
                                </p>
                                <ul>
                                    <li>I've programmed in a plethora of languages (C, C++, Java, Python, NodeJS, javaScript, VB, PHP, and even: Pascal & BASIC)</li>
                                    <li>I have 18 yr of design and development experience.  That means I know how an ideal design process is supposed
                                        to work and when to be flexible.  So whether you're working in a traditional, Scrum, Agile, or whatever dev 
                                        cycle suits your team, know that I'm very familiar with a variety of design cycles.</li>
                                    <li>I have 3 yrs of startup experience. I know what it means to wear many hats and create new processes from the ground up.</li>
                                    <li>I’m passionate about software development, so I’m always open to learning new skills. Whether it’s an AWS EC2 hosted game 
                                        server, React/Node.js website, an Arduino GPS module, or a mySQL database populated by a PHP backend utilizing Blizzard’s 
                                        API, the effort I put into developing personal projects is a reflection of my excitement to solve the worlds problems with software.</li>
                                    <li>I primarily develop web applications applications in React/NodeJS/mySQL</li>
                                    <li>My <a href="./projects/">personal projects</a> range from CNC woodworking to Cellular Antenna design</li>
                                    <li>I'm always learning.  Currently enrolled in Georgia Tech's Computer Science Master's program and working toward my first AWS 
                                        practitioner certificate.
                                    </li>
                                    <li>For the most part, I build my own computers, servers, LANs.</li>
                                </ul>
                                </Card.Body>
                            </Accordian.Collapse>
                        </Card>
                    </Accordian>
                    <Accordian>
                        <Card>
                            <Accordian.Toggle as={Card.Header} eventKey="0">
                                Are you interested in ____________?
                            </Accordian.Toggle>
                            <Accordian.Collapse eventKey="0">
                                <Card.Body>
                                <p>Quite possibly.  At the moment, I'm looking for a company in Chattanooga, TN that peaks my interest.  Ideally I'd want to hang out with my co-workers outside of the office, the work
                                    would be engaging, and I'd have opportunities to develop new products.
                                </p>
                                <p>If you think you've found something suitable, shoot me an <a href="mailto:davidhanks@gmail.com">email</a> with the job description or give me a call.</p>
                                </Card.Body>
                            </Accordian.Collapse>
                        </Card>
                    </Accordian>
                </div>
                <div className="col-md-4 certificates resumeBorder">
                <div className="socialDiv">
                        <a className="fa fa-linkedin-square" style={socialBlock} href="https://www.linkedin.com/in/thedavidhanks" target="_blank" rel="noopener noreferrer"> </a>
                        <a className="fa fa-github-square"  style={socialBlock} href="https://github.com/thedavidhanks/" target="_blank" rel="noopener noreferrer"> </a>
                        <a className="fa fa-facebook-square" style={socialBlock} href="https://www.facebook.com/david.hanks" target="_blank" rel="noopener noreferrer"> </a>
                    </div>
                    <h5>Resumes</h5>
                    <ul>
                        <li><a href="https://tdh-public-files.s3.us-east-2.amazonaws.com/resume/SeniorMechanicalEngineer.pdf" target="_blank" rel="noopener noreferrer">Sr. Mechanical Engineer</a></li>
                        <li><a href="https://tdh-public-files.s3.us-east-2.amazonaws.com/resume/SoftwareDeveloper.pdf" target="_blank" rel="noopener noreferrer">Software Developer</a></li>
                    </ul>
                    <h5>Certificates</h5>
                    <ul>
                        <li><a href="https://engineers.texas.gov/roster/pesearch.html##result-top" target="_blank" rel="noopener noreferrer">P.E. (104644)</a></li>
                        <li>Eagle Scout</li>
                        
                    </ul>
                    <h5>Coursework</h5>
                    <ul>
                        <li><a href="http://omscs.gatech.edu/cs-6250-computer-networks" target="_blank" rel="noopener noreferrer">Computer Networks</a></li>
                        <li><a href="http://omscs.gatech.edu/cs-6200-introduction-operating-systems" target="_blank" rel="noopener noreferrer">Intro to OS</a></li>
                        <li><a href="http://omscs.gatech.edu/cs-6300-software-development-process" target="_blank" rel="noopener noreferrer">Software Dev Process</a></li>
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
                        <span className="">hydraulics, </span>
                        <span className="">structural analysis</span>
                    </div>
                </div>    
            </div>
        </div>
                
    );
} 
export default AboutMe;