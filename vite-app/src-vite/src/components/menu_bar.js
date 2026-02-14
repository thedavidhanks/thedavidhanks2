import React from 'react';
import MenuItem from './menu_item';
import SearchBar from './search_bar';

const MenuBar = (props) => {
    const menuItems = props.menuItems.map((item) => {
        return <MenuItem word={item.name} key={item.name} path={item.path}/>;
    });
    return (
        <nav className="navbar navbar-expand-md navbar-dark bg-dark">
            <span className="navbar-brand mb-0 h1">TheDavidHanks</span>
            <div className="collapse navbar-collapse" id="navbarSupportedContent">
                <ul className="navbar-nav mr-auto">
                    {menuItems}
                </ul>
                <SearchBar />
            </div>
            {props.menuItems.length}
        </nav>
    );
};
 
export default MenuBar;