import React, { Component } from 'react';
import CardGroup from 'react-bootstrap/CardGroup';
import Container from 'react-bootstrap/Container';
import {  
  Routes,
  Route,
} from "react-router-dom";
//project images
import mimo from './mimo.png';
import bopdiagram from './shearbopdiagram.png';
import styles from './styles.js';

//Project Pages
import CricketAntenna from './pages/CricketAntenna';
import GpsTracker from './pages/GpsTracker';
import ShearCalculator from './pages/ShearCalculator';
import PythonReport from './pages/PythonReport';
import Kaleidoscope from './pages/Kaleidoscope';
import JobCompare from './pages/JobCompare';

import ProjectCard from './ProjectCard';

const projectlist = [
  {
    path: "projects/gps-tracker",
    element: <GpsTracker/>,
    title: "GPS Tracking Site",
    description: "tracks my RV as I travel.  It utilizes an arduino GPS module, React site and PHP backend",
    tags: ["Arduino", "React"]
  },
  {
    path: "projects/cellantenna",
    element: <CricketAntenna/>,
    title: "Cell Antenna",
    description: "a mobile directional cellular/wifi antenna providing internet connection utilizing a 12V source",
    tags: ["Design"],
    imgsrc: mimo
  },
  {
    path: "projects/shearcalculator",
    element: <ShearCalculator/>,
    title: "Shear Calculator",
    description: "A online PHP/mySQL tool for engineers to evaluate the capabilities of offshore cutting devices and generate reports for clients",
    tags: ["Engineering", "PHP", "mySQL"],
    imgsrc: bopdiagram
  },
  {
      path: "projects/kaleidoscope",
      element: <Kaleidoscope/>,
      title: "Kaleidoscope",
      description: "a present for my wife",
      tags: ["CNC", "3dPrinters", "3dModeling", "Electronics"]
  },
  {
      path: "projects/temphumiditysensor",
      element: <ClimateSensor/>,
      title: "Temp & Humidy Sensor",
      description: "a sensor loggs environment conditions and is graphed on website.",
      tags: ["Arduino", "HTML5", "mySQL", "PHP", "js"]
  },
  {
      path: "projects/pythonreport",
      element: <PythonReport/>,
      title: "Autogenerated Python Reports",
      description: "a Python script that turned inspections logged in excel to hundreds of pdf reports in minutes.",
      tags: ["Python"]
  }, 
  {
    path: "projects/jobcomparer", 
    element: <JobCompare/>,
    title: "Job Comparer Android App",
    description: "Android application that is used to compare job offers and provide a score based on user preferences.  ",
    tags: ["Java", "Android"]
}, 
];
//projects to add:
  //Spare oom bench
  //CNC pull-up bar
  //Android job comparison app

class ProjectHome extends Component {
  // create a list of Route components based on project list

  projectRoutes = projectlist.map((project, i) => {
    return (
      <Route 
        key={i} 
        path={project.path}
        element={project.element}
      />
    )});

    render(){
        return (
            <Routes>
              <Route path="/" element={<CardContainer projectlist={projectlist}/>} />
              {this.projectRoutes}
                 {/* <Route path="/projects/kaleidoscope" element={<Kaleidoscope/>} /> }
                <Route path="/projects" element={<CardContainer projectlist={projectlist}/>} /> */}
             </Routes>
        );                 
    }  
};

function ClimateSensor() {
  return <Container><h3>Temperature & Humidity Sensor</h3><p>More to come...</p></Container>;
}

const CardContainer = ({projectlist}) => {
  return (
       <CardGroup>
          {projectlist.map((project,i) => 
              (<ProjectCard 
                  title={project.title} 
                  tags={project.tags}
                  endpoint={project.path}
                  key={i}
                  id={i}
                  imgsrc={project.imgsrc}
                  style={styles.projectCard}
                  >
                  {project.description}
              </ProjectCard>)
          )}
        </CardGroup>
    )
}



export default ProjectHome;