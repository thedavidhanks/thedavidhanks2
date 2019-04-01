import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Route } from 'react-router-dom';
import { auth, provider } from './firebase.js'

import BSnavbar from './components/BSnavbar';
import ToolHome from './components/tool_home';
import ProjectHome from './components/project_home';
import AboutMe from './components/about_me';
import NWmap from './components/nwmap';
import './index.css';

class App extends Component {
    constructor(props){
        super(props);
        //this.login = this.login.bind(this);
        //this.logout = this.logout.bind(this);
        
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
                <div role="main" className="row">
                    <Route exact path="/tools" component={ToolHome}/>
                    <Route path="/tools/nwmap" component={NWmap} />
                    <Route path="/projects" component={ProjectHome}/>
                    <Route path="/about" component={AboutMe}/>
                </div>
            </div>
        </BrowserRouter>
        );
    }
};

ReactDOM.render(<App />, document.getElementById('root'));
