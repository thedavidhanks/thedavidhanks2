import React, { Component } from 'react';
import CardGroup from 'react-bootstrap/CardGroup';
import {  
  Routes,
  Route,
} from "react-router-dom";
import styles from './styles.js';
import ProjectCard from './ProjectCard.jsx';
import { projectlist } from './projectlist.jsx';
import PageMeta from '../PageMeta.jsx';
import { pageTitle } from '../../seo.js';

class ProjectHome extends Component {
  // create a list of Route components based on project list

  projectRoutes = projectlist.map((project, i) => {
    return (
      <Route 
        key={i} 
        path={project.path}
        element={<>
          <PageMeta title={pageTitle(project.title)} description={project.description} path={`/${project.endpoint}`} />
          {project.element}
        </>}
      />
    )});

    render(){
        return (
            <Routes>
              <Route path="/" element={<>
                <PageMeta
                  title={pageTitle('Projects')}
                  description="Hardware and software projects by David Hanks: an Arduino GPS tracker, a cell antenna, an offshore shear calculator, Python reporting and more."
                  path="/projects"
                />
                <CardContainer projectlist={projectlist}/>
              </>} />
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