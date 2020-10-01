import React, { Component } from 'react';
import CardColumns from 'react-bootstrap/CardColumns';
import Container from 'react-bootstrap/Container';
import {  
  Switch,
  Route,
} from "react-router-dom";
//project images
import mimo from './mimo.png';

//Project Pages
import CricketAntenna from './pages/CricketAntenna';
import GpsTracker from './pages/GpsTracker';
import ShearCalculator from './pages/ShearCalculator';

import ProjectCard from './ProjectCard';

const projectlist = [
  {
    path: "/projects/gps-tracker",
    component: GpsTracker,
    title: "GPS Tracking Site",
    description: "tracks my RV as I travel.  It utilizes an arduino GPS module, React site and PHP backend",
    tags: ["Arduino", "React"]
  },
  {
    path: "/projects/cellantenna",
    component: CricketAntenna,
    title: "Cell Antenna",
    description: "a mobile directional cellular/wifi antenna providing internet connection utilizing a 12V source",
    tags: ["Design"],
    imgsrc: mimo
  },
  {
    path: "/projects/shearcalculator",
    component: ShearCalculator,
    title: "Shear Calculator",
    description: "A online PHP/mySQL tool for engineers to evaluate the capabilities of offshore cutting devices and generate reports for clients",
    tags: ["Engineering", "PHP", "mySQL"]
  },
  {
      path: "/projects/kaleidoscope",
      component: Kaleidoscope,
      title: "Kaleidoscope",
      description: "a present for my wife",
      tags: ["CNC", "3dPrinters", "3dModeling"]
  },
  {
      path: "/projects/temphumiditysensor",
      component: ClimateSensor,
      title: "Temp & Humidy Sensor",
      description: "a sensor loggs environment conditions and is graphed on website.",
      tags: ["Arduino", "HTML5", "mySQL", "PHP", "javascript"]
  }
  
];

class ProjectHome extends Component {
    render(){
        return (
            <Switch>
                {projectlist.map((project, i) => (
                    <Route 
                        key={i} 
                        path={project.path}
                        render={()=><project.component />}
                    />
                ))}
                <Route path="/projects">
                  <CardColumns>
                    {projectlist.map((project,i) => (
                        <ProjectCard 
                            title={project.title} 
                            tags={project.tags}
                            endpoint={project.path}
                            key={i}
                            imgsrc={project.imgsrc}
                            >
                            {project.description}
                        </ProjectCard>
                    ))}
                </CardColumns>
                </Route>
            </Switch>
        );                              
    }  
};

function Kaleidoscope() {
  return <Container><h3>Kaleidoscope</h3><p>More to come...</p></Container>;
}
function ClimateSensor() {
  return <Container><h3>Temperature & Humidity Sensor</h3><p>More to come...</p></Container>;
}

export default ProjectHome;