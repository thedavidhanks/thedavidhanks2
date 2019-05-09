import React, { Component } from 'react';

import ResumeCompany from './resume/ResumeCompany';
import ResumePosition from './resume/ResumePosition';
import profile from '../images/profile.jpg'

const socialBlock = {
    fontSize: "48px"
};
class AboutMe extends Component {
  constructor(props){
        super(props);

        this.state = { 
            mechCheck: "",
            softCheck: ""
        };
    }
    handleInputChange = (e) => {
        const target = e.target;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        this.setState({
            [target.name] : value
        });
    }
  render(){
    return (
        <div className="resume">
            <div className="row">
                <div className="header col-md-10">Resume</div>
                <div className="col block-links">
                    <div className="row">
                        <div className="col-8 profileDiv">
                            <img src={profile} className="profileImg "/>
                        </div>
                        <div className="col-4 socialDiv">
                            <a className="fa fa-linkedin-square" style={socialBlock} href="https://www.linkedin.com/in/thedavidhanks"></a>
                            <a className="fa fa-github-square" style={socialBlock} href="https://github.com/thedavidhanks/"></a>
                        </div>
                    </div>
                </div>
            </div>    
            <hr />
            <div className="row">
                <div className="col"></div>
                <div className="ck-button col-md-1">
                    <label>
                        <input hidden name="mechCheck" type="checkbox" checked={this.state.mechCheck} onChange={this.handleInputChange} />
                        <span>Mechanical</span>
                    </label>
                </div>
                <div className="ck-button col-md-1">        
                    <label>
                        <input hidden name="softCheck" type="checkbox" checked={this.state.softCheck} onChange={this.handleInputChange} />
                        <span>Software</span>
                    </label>
                </div>
            </div>
            <div className="row">
                <div className="col">Let me tell you about me and what I'm looking for...</div>
            </div>
            <div className="row">
                <div className="col-md-9 workExperience">
                    <div className="header2">Work Experiences</div>
                    <ResumeCompany company="Offshore Technical Solutions" start="Sept 2015" end="present">
                        <ResumePosition title="Senior Professional Engineer">
                            <ul>
                                <li>Developed web based form utilizing <ToggleHighlight software={true} showSoftware={this.state.softCheck} showMechanical={this.state.mechCheck}>React, jQuery, AJAX, PHP, and mySQL</ToggleHighlight></li>
                                <li><ToggleHighlight mechanical={true} showSoftware={this.state.softCheck} showMechanical={this.state.mechCheck}>Performed analysis</ToggleHighlight> for offshore vessels required by the US government.</li>
                                <li>Evaluated hydraulic safety systems on drilling rigs as required by regulations</li>
                            </ul>
                        </ResumePosition>
                    </ResumeCompany>
                    <ResumeCompany company="Oceaneering" start="Oct 2014" end="Nay 2015">
                        <ResumePosition title="Senion Subsea Controls Engineer">
                            <ul>
                                <li>Lead a team of engineers and designers in the development of blow out preventer hydraulic control systems</li>
                                <li>Reviewed drawings, Solidworks models and calculations for the release of new product</li>
                            </ul>
                        </ResumePosition>
                    </ResumeCompany>
                    <ResumeCompany company="General Electric" start="May 2006" end="Sept 2014">
                        <ResumePosition title="Senior Subsea Controls Engineer, New Product Introduction">
                        <ul>
                            <li>Lead design and development of the next generation electro/hydraulic subsea control pod through writing specifications, reviewing drawings, analysis, selecting components, developing testing, and tracking progress.</li>
                            <li>Presented design reviews to chief engineers, manufacturing, and sourcing.</li>
                        </ul>
                        </ResumePosition>
                        <ResumePosition title="Lead Product Engineer, Subsea Controls">
                            <ul>
                                <li>Selected or modified hydraulic control components for new systems</li>
                                <li>Worked closely with manufacturing, designers, planners, vendors, and clients to meet deliverables</li>
                                <li>Created and coordinated tests of new product</li>
                                <li>Responded to manufacturing concerns related to production</li>
                                <li>Mentored and trained new engineers</li>
                            </ul>
                        </ResumePosition>
                        <ResumePosition title="Field Engineer">
                            <ul>
                                <li>Commissioned GE control systems</li>
                                <li>Conducted troubleshooting and repairs on hydraulic control systems</li>
                            </ul>
                        </ResumePosition>
                    </ResumeCompany>
                </div>
                <div className="col-md-3 certificates resumeBorder">
                    <h5>Certificates</h5>
                    <ul>
                        <li><a href="https://www.udemy.com/certificate/UC-U878XCQQ/">React/Redux</a></li>
                        <li><a href="https://www.udacity.com/course/java-programming-basics--ud282?utm_campaign=android_pathway&utm_medium=referral&utm_source=aws_s3_pdf">Java</a></li>
                        <li><a href="https://courses.edx.org/certificates/5906b12c3b864b4a9301b1b02d2f867f">jQuery</a></li>
                        <li><a href="https://www.udemy.com/git-bootcamp-with-github-learn-step-by-step/learn/v4/content">Git</a></li>
                        <li><a href="https://courses.edx.org/certificates/1a98e664ec694a7ea85a5a9117548ac0">HTML/CSS</a></li>
                    </ul>
                    
                </div>    
            </div>
            
            
        </div>
                
    );
  }  
};

const ToggleHighlight = (props) => {
    const highlight = (props.software && props.showSoftware) || (props.mechanical && props.showMechanical) ? true : false;
    return <span className={ highlight ? "highlight" : ""}>{props.children}</span>;
    
};

export default AboutMe;