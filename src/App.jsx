import { Component } from 'react';
import { Route, Routes } from 'react-router-dom';
import { auth, provider } from './firebase.js'

import BSnavbar from './components/BSnavbar.jsx';
import ToolHome from './components/tools/index.jsx';
import ProjectHome from './components/projects/index.jsx';
import AboutMe from './components/aboutme/index.jsx';
import AskMe from './components/askme/index.jsx';

// The router is supplied by the caller (BrowserRouter in main.jsx,
// MemoryRouter in tests) so App can be rendered without touching the DOM.
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
            <div className="app-shell">
                <BSnavbar user={this.state.user} login={this.login} logout={this.logout}/>
                <div role="main" className="row contentwrapper">
                    <Routes>
                        <Route path="/" element={<AboutMe/>}/>
                        <Route path="/tools/*" element={<ToolHome user={this.state.user} login={this.login}/>}/>
                        <Route path="/projects/*" element={<ProjectHome/>}/>
                        <Route path="/about" element={<AboutMe/>}/>
                        <Route path="/askme" element={<AskMe/>}/>
                    </Routes>
                </div>
            </div>
        );
    }
};

export default App;
