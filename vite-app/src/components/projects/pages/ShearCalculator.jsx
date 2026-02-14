import React from 'react';
import Container from 'react-bootstrap/Container';
import Carousel from 'react-bootstrap/Carousel';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

import shearweb from './slides/shearbopweb.png';
import shearbop from './slides/shearcalcbop2.jpeg';
import shearbopdiagram from './slides/shearbopdiagram.png';

const ShearCalculator = (props) => {

    return(
    <Container>
        <h3>Shear Calculator</h3>
        <p>The shear calculator is a PHP/mySQL deployment.  The website
        allows a user to input parameters for calculation and produces a 
        downloadable Word document which can be sent to a client.</p>
        <Container className="carouselContainer w-50">
          <Carousel className="">
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={shearbop}
                alt="Hydril BOP"
              />
              <Carousel.Caption>
                <h3>Blow Out Preventer</h3>
                <p>A single BOP manufactured by Hydril</p>
              </Carousel.Caption>
            </Carousel.Item>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={shearweb}
                alt="Website"
              />

              <Carousel.Caption>
                <h3>Shear Calculator</h3>
                <p>The front end displays a form with content from mySQL.</p>                
              </Carousel.Caption>
            </Carousel.Item>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src={shearbopdiagram}
                alt="diagram"
              />

              <Carousel.Caption>
                <h3>Force Diagram</h3>
                <p>The calculator computes forces on the BOP piston.</p>
              </Carousel.Caption>
            </Carousel.Item>
          </Carousel>
        </Container>
        <h5>Background</h5>
        <p>When drilling an oil well offshore in the United States operators 
        (such as Exxon, Shell, BP) are required to obtain permitting from the
        Bureau of Safety and Environmental Enforcement.  Part of their permitting
        requries a third party evaluation of their  
        <OverlayTrigger
            placement="right"
            delay={{ show: 250, hide: 400 }}
            overlay={<Tooltip id="button-tooltip-2">
                    For those unfamiliar with offshore equipment a blow-out preventer 
                    (or BOP) is a large valve that can close a well to prevent oil from 
                    spurting out the top.</Tooltip>}
        >
        <a href="/#"> blow-out preventer (BOP) system.</a> 
        </OverlayTrigger>
        </p>  
        <p>Evaluation of the 
        <OverlayTrigger
            placement="right"
            delay={{ show: 250, hide: 400 }}
            overlay={<Tooltip id="button-tooltip-2">
                    a type of BOP that cuts pipe</Tooltip>}
        >
        <a href="/#"> shear bop </a> 
        </OverlayTrigger>
        is midly complex.  It involves taking in various 
        inputs, determining which calculation method is appropriate, and comparing 
        the results to test data.</p>
        <h5>The Old Process</h5>
        <p>As discussed above, the evaluation is midly complex. The evaluation methods 
        (normally involving spreadsheets) can be tedious, error-prone, inconsistent, 
        and lengthy.  A user is required to enter data from the BOP, offshore rig,
        drilling site, and the pipe going down hole.  Data is found in user manuals
        API (American Petroleum Institute) specifications, operator reports, and 
        various other places.  After the data is entered the user has to decide
        which equation is most suitable for all the parameters entered.  When the user
        has obtained results from the equation, he then has to locate a test 
        report demonstrating that the values are accepable.  Once that is 
        determined, a report is generated.  Then a second user has to verify the 
        contents of the report (basically go through all the previous steps). 
        Finally, once both users agree (after much back and forth) the report is 
        delivered to a client.</p>  
        
        <p>The whole process can take several hours to several weeks.  
        There was a clear need to create a consistent report in a short amount
        of time.</p>
        
        <p>The Shear Calculator was able to bring most of the data to a single web
        page for the user, allowing for a consistent report to be completed in minutes.</p>
        
        <h5>The Software Components</h5>
        <ul>
            <li><b>Website</b> -
                    (<a href="https://github.com/thedavidhanks/OTCSengineering_tools" 
                    target="_blank" rel="noopener noreferrer">git</a>)
                    (
                    <OverlayTrigger
                        placement="top"
                        delay={{ show: 250, hide: 400 }}
                        overlay={<Tooltip id="button-tooltip-2">
                                This site is setup on a free heroku instance and 
                                only provides some of the functionality of the 
                                original internal tool</Tooltip>}
                    >
                    <a href="http://otc-engineering-tools.herokuapp.com/?page=calcs&sub=mtsc#">
                        temp site</a>
                    </OverlayTrigger>
                    )
                    <p>The website is primarily built and served as a PHP site. 
                    A fair portion of the content is supported by HTML5, 
                    and javascript.  The form leverages the jQuery library to 
                    reformat the inputs based on user interaction.  Queries to the 
                    backend database are performed by PHP.  A majority of the 
                    styling is provided by Bootstrap 3 classes.  Verson control
                    is handled with git.</p>
            </li>
            <li><b>Database</b> - A mySQl database stores data on pipe, bops,
            previous reports
            </li>
        </ul>
        <h5>Improvements</h5>
        <p>This site was first deployed internally around mid 2017 and utilized 
        for a few years.  It performed very well in its goal to reduce report 
        development time and provide consistent formatting.  There were a long 
        list of "to-dos" and many were never fully realized. The site
        had many
        flaws and if I had to do it over again it would be a new beast.  A lot 
        of the development was based on my outdated experience developing in PHP
         and as I learned more about "modern" approaches and languages the site 
         evolved.  Here's a list of some of the site's lacking:</p>
         <ul>
            <li><b>No framework</b> - I built the site as pure front end PHP site 
            with about 20,000 lines of code and 
            did not take advantage of a framework.  This was primarily due to my 
            ignorace of
            frameworks.  While I did utilize Composer to manage dependencies, 
            utilizing a framework like Symphony or CodeIgniter could have helped to 
            reduce complexities.
            </li>
            <li><b>Segregate the View & Controller</b> - Unlike the typical 
            Model-View-Controller architecture, the Shear Calculator had both view and controller
            components present in the front end site.  In later sites I've developed
            the controller portion (normally PHP or NodeJS) has been separated and 
            provides endpoints for the front end site.  An architecture with 
            segregated components would be ideal since it provides a better interface 
            for maintaining and testing components.</li>
            <li><b>Lacking Security</b> - While this site was maintained and 
            deployed internally, security should always be considered.  The site 
            initially exposed some semi-sensitive information which should have 
            been hidden.  Additionally at present, there are several dependencies with known 
            vulnerabilities that require updating.</li>
         </ul>
        <h5>Future</h5>
        <p>The website had several other tools besides the shear calculator that
        were in development.  As the site's content grew and as I learned more about software arcticture and 
        modern languages, I ultimately chose to scrap the site and rework it in a more modern
        React/NodeJS/mySQL application.  An earlier public framework for this 
        site is avilable <a href="https://github.com/thedavidhanks/otc-react-app" 
        target="_blank"  rel="noopener noreferrer">here.</a>  The site has since gone into private 
        development.
        The React site was developed to address
        the concerns listed above and to allow me to explore other software 
        strategies and languages.</p>
    </Container>
    );
};

export default ShearCalculator;