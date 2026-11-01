import React, { Component } from 'react';
import CardGroup from 'react-bootstrap/CardGroup';
import {  
  Routes,
  Route,
} from "react-router-dom";
import styles from './styles.js';
import ProjectCard from './ProjectCard.jsx';
import { projectlist } from './projectlist.jsx';

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

const CardContainer = ({projectlist}) => {
  return (
       <CardGroup>
          {projectlist.map((project,i) => 
              (<ProjectCard 
                  title={project.title} 
                  tags={project.tags}
                  endpoint={project.endpoint}
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