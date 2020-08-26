import React, { Component } from 'react';
import CardColumns from 'react-bootstrap/CardColumns';
import {  
  Switch,
  Route,
} from "react-router-dom";

import ProjectCard from './ProjectCard';

const projectlist = [
  {
    path: "/projects/cellantenna",
    component: CellAntenna,
    title: "Cell Antenna",
    description: "a mobile directional cellular/wifi antenna providing internet connection utilizing a 12V source",
    tags: ["Design"],
    imgsrc: "./mimo.png"
  },
  {
    path: "/projects/shearcalculator",
    component: ShearCalculator,
    title: "Shear Calculator",
    description: "A online PHP/mySQL tool for engineers to evaluate the capabilities of offshore cutting devices and generate reports for clients",
    tags: ["Engineering", "PHP", "mySQL"]
  },
  {
    path: "/projects/gps-tracker",
    component: GpsTracker,
    title: "GPS Tracking Site",
    description: "tracks the cricket",
    tags: ["Arduino", "React"]
  },
  {
      path: "/projects/kaleidoscope",
      component: Kaleidoscope,
      title: "Kaleidoscope",
      description: "a present for my wife",
      tags: ["CNC", "3dPrinters", "3dModeling"]
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

function CellAntenna() {
  return <h3>Cell Antenna</h3>;
}
function ShearCalculator() {
  return <h3>Shear Calculator</h3>;
}
function GpsTracker() {
  return <h3>GPS Tracker</h3>;
}
function Kaleidoscope() {
  return <h3>K-scoper</h3>;
}

export default ProjectHome;