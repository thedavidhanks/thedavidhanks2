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
        {value: 'language', label: 'progamming language'},
        {value: 'cad', label: 'CAD'},
        {value: 'analysis', label: 'analysis'},
        {value: 'jslibraries', label: 'Libraries'}
    ]

    const [skills, setSkills] = useState(skillscategories);
    const [skillsDOM, setSkillsDOM] = useState();
    useEffect( () =>{
        console.log("skills changed");
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
            console.log("no skills")
        }
    }, [skills]);

    const updateSkills = (value) => {
        setSkills(value);
    }
    
    return (
        <div className="resume">

            <div className="row">
                <div className="col-md-8 ">
                    <h2>About me.</h2>
                    <p>I'm an engineer, developer, tinkerer, climber, ultimate freesbie player, eagle scout, traveller, native Cajun and husband.  
                        My wife and I moved to Chattanooga, TN from Houston, TX after an 8 month road trip around the US.  I'm exploring what the beautiful country-side has to offer
                        while attempting to lay down some roots.  </p>
                    <p>In 2002 I graduated from the University of Louisiana with a BS in Mechanical Engineering. I've spent the
                         majority of my career developing and maintaining oil and gas product lines.  Specifically I've worked on tongs/slips, Blow-out preventers, and supporting
                         controls.  I've been able to experince the full range of product life cycle: from developing a specification with a customer, through creating/reviewing 
                         drawings, analyizing loads, writing and conducting tests, and installing equipment on-site.
                    </p>
                    <p>
                        In more recent years, I've turned my attention to developing software tools.  
                    </p>
                    <h3>Me and Software Development</h3>
                    <p>I've been developing software since my family got an Apple IIgs.  
                        I've programmed in a plethora of languages (C, C++, Java, Python, NodeJS, javaScript, VB, PHP, Pascal, BASIC)
                    </p>
                    <h3>In case you were looking for a developer...</h3>
                    <p>You may have landed here looking for a seasonsed Sr. Software Architech with 10+ yrs experience.  This is not me.  </p>
                </div>
                <div className="col-md-4 certificates resumeBorder">
                    <h5>Resumes</h5>
                    <ul>
                        <li><a href="https://tdh-public-files.s3.us-east-2.amazonaws.com/resume/SeniorMechanicalEngineer.pdf" target="_blank" rel="noopener noreferrer">Sr. Mechanical Engineer</a></li>
                        <li><a href="https://tdh-public-files.s3.us-east-2.amazonaws.com/resume/SoftwareDeveloper.pdf" target="_blank" rel="noopener noreferrer">Software Developer</a></li>
                    </ul>
                    <h5>Certificates</h5>
                    <ul>
                        <li><a href="https://engineers.texas.gov/roster/pesearch.html##result-top" target="_blank" rel="noopener noreferrer">P.E. (104644)</a></li>
                        <li><a href="">AWS CCP (coming soon)</a></li>
                        <li>Eagle Scout</li>
                        
                    </ul>
                    <h5>Coursework</h5>
                    <ul>
                        <li><a href="http://omscs.gatech.edu/cs-6250-computer-networks" target="_blank" rel="noopener noreferrer">Computer Networks</a></li>
                        <li><a href="http://omscs.gatech.edu/cs-6200-introduction-operating-systems" target="_blank" rel="noopener noreferrer">Intro to OS</a></li>
                        <li><a href="http://omscs.gatech.edu/cs-6300-software-development-process" target="_blank" rel="noopener noreferrer">Software Dev Process</a></li>
                        <li><a href="https://www.udemy.com/certificate/UC-U878XCQQ/" target="_blank" rel="noopener noreferrer">React/Redux</a></li>
                        <li><a href="https://www.udacity.com/course/java-programming-basics--ud282?utm_campaign=android_pathway&utm_medium=referral&utm_source=aws_s3_pdf" target="_blank" rel="noopener noreferrer">Java</a></li>
                        <li><a href="https://courses.edx.org/certificates/5906b12c3b864b4a9301b1b02d2f867f" target="_blank" rel="noopener noreferrer">jQuery</a></li>
                        <li><a href="https://www.udemy.com/git-bootcamp-with-github-learn-step-by-step/learn/v4/content" target="_blank" rel="noopener noreferrer">Git</a></li>
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
                        <span className="cad highlightSkill">Solidworks, </span>
                        <span className="cad highlightSkill">AutoCAD, </span>
                        <span className="cad highlightSkill">Fusion360, </span>
                        <span className="cad highlightSkill">Inventor,  </span>
                        <span className="cad highlightSkill">Pro/E, </span>
                        <span className="analysis highlightSkill">Ansys, </span>
                        <span className="ide developer highlightSkill">Visual Studio Code, </span>
                        <span className="ide developer highlightSkill">Visual Studio, </span>
                        <span className="ide developer highlightSkill">NetBeans, </span>
                        <span className="vcs developer highlightSkill">git, </span>
                        <span className="vcs developer highlightSkill">github, </span>
                        <span className="language developer highlightSkill">python, </span>
                        <span className="language developer highlightSkill">C, </span>
                        <span className="language developer highlightSkill">C++, </span>
                        <span className="language developer highlightSkill">Java, </span>
                        <span className="language developer highlightSkill">javascript, </span>
                        <span className="language developer highlightSkill">NodeJS, </span>
                        <span className="jslibraries developer highlightSkill">ReactJS, </span>
                        <span className="jslibraries developer highlightSkill">Leaflet, </span>
                        <span className="jslibraries developer highlightSkill">Bootstrap</span>
                    </div>
                     

                    <div className="socialDiv">
                        <a className="fa fa-linkedin-square" style={socialBlock} href="https://www.linkedin.com/in/thedavidhanks" target="_blank" rel="noopener noreferrer"></a>
                        <a className="fa fa-github-square" style={socialBlock} href="https://github.com/thedavidhanks/" target="_blank" rel="noopener noreferrer"></a>
                        <a className="fa fa-facebook-square" style={socialBlock} href="https://www.facebook.com/david.hanks" target="_blank" rel="noopener noreferrer"></a>
                    </div>
                </div>    
            </div>
        </div>
                
    );
} 
export default AboutMe;