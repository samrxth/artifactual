import React, { Component } from "react";
import mermaid from "mermaid";

// Initialize mermaid with specific settings
mermaid.initialize({
  startOnLoad: true,
  theme: "default",
  securityLevel: "loose",
  themeCSS: `
    g.classGroup rect {
      fill: #ffffff;
      stroke: #6272a4;
    } 
    g.classGroup text {
      fill: #000000;
    }
    g.classGroup line {
      stroke: #000000;
      stroke-width: 0.5;
    }
    .classLabel .box {
      stroke: #ffffff;
      stroke-width: 3;
      fill: #ffffff;
      opacity: 1;
    }
    .classLabel .label {
      fill: #ff79c6;
    }
    .relation {
      stroke: #50fa7b;
      stroke-width: 1;
    }
    #compositionStart, #compositionEnd {
      fill: #bd93f9;
      stroke: #bd93f9;
      stroke-width: 1;
    }
    #aggregationEnd, #aggregationStart {
      fill: #ffffff;
      stroke: #50fa7b;
      stroke-width: 1;
    }
    #dependencyStart, #dependencyEnd {
      fill: #00bcd4;
      stroke: #00bcd4;
      stroke-width: 1;
    } 
    #extensionStart, #extensionEnd {
      fill: #000000;
      stroke: #000000;
      stroke-width: 1;
    }`,
  fontFamily: "Fira Code"
});

// Define types for the props expected by the component
interface MermaidProps {
  chart: string;
}

// TypeScript class component for rendering Mermaid diagrams
export default class Mermaid extends Component<MermaidProps> {
  componentDidMount() {
    mermaid.contentLoaded();
  }

  render() {
    return <div className="mermaid" style={{ backgroundColor: "#ffffff" }}>{this.props.chart}</div>;
  }
}

