basePath = '../';

files = [
  JASMINE,
  JASMINE_ADAPTER,
  'client/lib/angular/angular.js',
  'client/lib/angular/angular-*.js',
  'test/lib/angular/angular-mocks.js',
  'client/js/vendor/jquery.js',
  'client/js/vendor/custom.modernizr.js',
  'client/js/vendor/underscore-min.js',
  'client/js/*.js',
  'test/unit/client/**/*.js'
];

autoWatch = true;

browsers = ['Chrome'];

junitReporter = {
  outputFile: 'test_out/unit.xml',
  suite: 'unit'
};
