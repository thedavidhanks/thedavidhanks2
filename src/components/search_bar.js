import React, { Component } from 'react';

class SearchBar extends Component {
  render(){
    return (
        <form className="d-flex my-2 my-lg-0">
            <input className="form-control me-sm-2" type="search" placeholder="Search" aria-label="Search" />
            <button className="btn btn-outline-success my-2 my-sm-0" type="submit">Search</button>
        </form>
    );
  }  
};
 
export default SearchBar;