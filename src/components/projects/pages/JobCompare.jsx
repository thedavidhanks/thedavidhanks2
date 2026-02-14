import React, { useState } from 'react';
import Container from 'react-bootstrap/Container';
import Carousel from 'react-bootstrap/Carousel';

import classdiagram from './slides/jobApp/TeamDesign.png';
import usecasediagram from './slides/jobApp/UseCase.png';

const JobCompare = (props) => {
    const [index, setIndex] = useState(0);

    const handleSelect = (selectedIndex) => {
        setIndex(selectedIndex);
    };

    return (
        <Container>
            <h3>Android Job Evaluator</h3>
            <p>
                In Fall of 2020, as part of a team for a Software Development Project course, I took part in the creation of an Android Java application that
                would compare job offers. We came up with a design document, project plan, use case diagram, and test plans.
            </p>
            <Container className="carouselContainer">
            <Carousel activeIndex={index} onSelect={handleSelect}>
                <Carousel.Item>
                    <div className="d-flex justify-content-center">
                        <img className="d-block w-50" src={classdiagram} alt="Class diagram" />
                    </div>
                    <Carousel.Caption>
                        <h3>Class diagram</h3>
                        <p>Shows the static structure of a system, including classes, attributes, operations, and relationships.</p>
                    </Carousel.Caption>
                </Carousel.Item>
                <Carousel.Item>
                    <div className="d-flex justify-content-center">
                        <img className="d-block w-50" src={usecasediagram} alt="Use case diagram" />
                    </div>
                    <Carousel.Caption>
                        <h3>Use Case diagram</h3>
                        <p>A representation of the functional requirements of the system, showing actors and their interactions with use cases</p>
                    </Carousel.Caption>
                </Carousel.Item>
            </Carousel>
            </Container>
            <p>The video below demonstrates the application.</p>
            <div className="d-flex justify-content-center">
                <iframe
                    width="560"
                    height="315"
                    src="https://www.youtube.com/embed/tMfKI3OSh8Q?si=HHWrRo35mwdxZvfP"
                    title="Job compare app video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                ></iframe>
            </div>
        </Container>
    );
};

export default JobCompare;