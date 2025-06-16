# Contributing to Low-Cost Kubernetes Cluster

Thank you for your interest in contributing to our Low-Cost Kubernetes Cluster project! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
   ```bash
   git clone https://github.com/YOUR-USERNAME/cluster.git
   cd cluster
   ```
3. **Add the upstream repository** as a remote
   ```bash
   git remote add upstream https://github.com/ctnr.io/cluster.git
   ```
4. **Create a new branch** for your feature or bugfix
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Process

### Key Principles

1. **Cost-Effectiveness**: All contributions should maintain or improve the cost-effectiveness of the cluster
2. **Resource Efficiency**: Changes should be optimized for limited hardware resources
3. **Simplicity**: Keep configurations simple and well-documented
4. **Reproducibility**: Ensure changes can be consistently reproduced

### Working with Templates

This project uses TypeScript templates to generate configuration files:

1. Make changes to files in the `templates/` directory
2. Run `make generate` to create the actual configuration files
3. Test your changes on a real cluster when possible

### Testing Changes

Before submitting a pull request:

1. Test your changes on actual Contabo VPS instances when possible
2. Verify that the cluster still functions correctly
3. Check resource usage to ensure efficiency
4. Validate that all generated files are correct

## Pull Request Process

1. **Update your fork** with the latest upstream changes
   ```bash
   git fetch upstream
   git merge upstream/main
   ```

2. **Commit your changes** with clear, descriptive commit messages
   ```bash
   git commit -m "Add feature: brief description of what was added"
   ```

3. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Submit a pull request** from your branch to the upstream main branch

5. **Pull request requirements**:
   - Clear description of the changes
   - Reference to any related issues
   - Documentation updates if applicable
   - Passing tests
   - Follows coding standards

6. **Address review feedback** promptly

7. **Merge approval**: Pull requests require approval from at least one maintainer

## Coding Standards

### TypeScript

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Follow ESLint configuration

### YAML

- Use 2 spaces for indentation
- Keep lines under 80 characters when possible
- Use comments to explain non-obvious configurations

### Documentation

- Keep documentation up-to-date with code changes
- Use clear, concise language
- Include examples where appropriate

## Testing

- Test changes on actual Contabo VPS instances when possible
- Verify cluster functionality after changes
- Check resource usage to ensure efficiency
- Validate all generated files

## Documentation

Good documentation is crucial for this project:

- Update README.md when adding new features or changing existing ones
- Document configuration options thoroughly
- Include examples of common use cases
- Explain the reasoning behind configuration choices, especially those related to cost-effectiveness

Thank you for contributing to making Kubernetes more accessible through cost-effective deployments!
