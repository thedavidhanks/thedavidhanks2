import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Route } from 'react-router-dom';
import { auth, provider } from './firebase.js'
import BSnavbar from './components/BSnavbar';
import ToolHome from './components/tool_home';
import ProjectHome from './components/project_home';
import AboutMe from './components/about_me';
import './index.css';

class App extends Component {
    constructor(props){
        super(props);
        
        this.state = { 
            menuItems: [
                { name: "Tools", path: "/tools"}, 
                {name: "Projects", path: "/projects"}, 
                {name: "About", path: "/about"}
            ]
        };
    }
    render(){
        return (
        <BrowserRouter>
            <div className="container">
                <BSnavbar user={this.state.user} login={this.login} logout={this.logout}/>
                <div role="main" className="row">
                    <Route path="/tools" component={ToolHome}/>
                    <Route path="/projects" component={ProjectHome}/>
                    <Route path="/about" component={AboutMe}/>
                </div>
            </div>
        </BrowserRouter>
        );
    }
};

ReactDOM.render(<App />, document.getElementById('root'));
