module.exports = {
  default: {
    require: ['e2e/steps/**/*.ts'],
    requireModule: ['ts-node/register/transpile-only'],
    format: [
      'progress',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber.json',
    ],
    formatOptions: {
      snippetInterface: 'synchronous',
    },
    paths: ['docs/testplan/**/*.feature'],
  },
};
