import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { auth, provider } from './firebase.js'

import BSnavbar from './components/BSnavbar';
import ToolHome from './components/tool_home';
import ProjectHome from './components/projects/';
import AboutMe from './components/aboutme/';
import NWmap from './components/nwmap';
import './index.css';

class App extends Component {
    constructor(props){
        super(props);
        
        this.state = { 
            menuItems: [
                {name: "Tools", path: "/tools"}, 
                {name: "Projects", path: "/projects"}, 
                {name: "About", path: "/about"}
            ],
            username: '',
            user: null
        };
    }
    logout = () => {
        auth.signOut()
            .then(() => {
                this.setState({
                    user: null
                });
             });
    }
    login = () => {
        auth.signInWithPopup(provider)
                .then((result) =>{
                    const user = result.user;
                    this.setState({
                        user
                    });
        });
    }  
    render(){
        return (
        <BrowserRouter>
            <div className="container">
                <BSnavbar user={this.state.user} login={this.login} logout={this.logout}/>
                <div role="main" className="row contentwrapper">
                    <Routes>
                        <Route exact path="/" element={<AboutMe/>}/>
                        <Route exact path="/tools" element={<ToolHome/>}/>
                        <Route path="/tools/nwmap" element={<NWmap/>} />
                        <Route path="/projects/*" element={<ProjectHome/>}/>
                        <Route path="/about" element={<AboutMe/>}/>
                    </Routes>
                </div>
            </div>
        </BrowserRouter>
        );
    }
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
