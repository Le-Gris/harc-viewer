# H-ARC Viewer

A web-based viewer for the Human-ARC (H-ARC) experiment interface. This project is built using [Smile](https://smile.gureckislab.org), a framework for creating online experiments.

## Overview

H-ARC presents the largest human evaluation of ARC to date, collecting over 15,000 solution attempts and detailed action traces from more than 1,700 participants on the full set of 400 training and 400 evaluation ARC tasks. This viewer provides an interface to explore and interact with the dataset.

## Features

- Interactive experiment interface
- Step-by-step behavioral action traces
- Natural-language solution descriptions
- Comprehensive performance data visualization
- Demographic and feedback data analysis

## Live Demo

Visit our dataset viewer at [arc-visualizations.github.io](https://arc-visualizations.github.io/)

## Development Setup

### Prerequisites

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Node.js](https://nodejs.org/en/download/)
- Git client
- [GitHub CLI](https://cli.github.com)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Le-Gris/harc-viewer.git
cd harc-viewer
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The development server will start at `http://localhost:3000/`

### Building for Production

To create a production build:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Project Structure

This project is built using Smile, which provides:

- Hot Module Replacement for faster development
- Automatic bundling and optimization
- Built-in development tools and utilities

For more detailed information about developing with Smile, visit the [official documentation](https://smile.gureckislab.org/developing.html).

## Dataset Access

The H-ARC dataset is available under a CC0 1.0 Universal license at [OSF](https://osf.io/bh8yq/).

## Authors

- Solim LeGris (New York University)
- Wai Keen Vong (Meta)
- Brenden Lake (New York University)
- Todd Gureckis (New York University)

## License

This project is open source and available under the MIT License.

## Acknowledgments

This project is built using [Smile](https://smile.gureckislab.org), a framework for creating online experiments developed by the Gureckis Lab at New York University.
