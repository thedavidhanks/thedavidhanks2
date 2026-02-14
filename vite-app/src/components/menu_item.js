import React, { Component } from 'react';

class MenuItem extends Component {
    constructor(props){
        super(props);
        this.state = {linkName: props.word, linkPath: props.path};
    }
    render(){
        return <li className="nav-item" onClick={this.onClicked}><a className="nav-link" href={this.state.linkPath}>{this.state.linkName}</a></li>;
    }  
    onClicked(event){
        //Do this when clicked
    }
};
export default MenuItem;