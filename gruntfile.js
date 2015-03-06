module.exports = function(grunt) {

  require('jit-grunt')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    manifest: grunt.file.readJSON('src/manifest.json'),
    zip: {
      'build/ScrollbarAnywhere-<%= manifest.version %>.zip': ['src/**/*']
    }
  });

  grunt.registerTask('default', []);
 
  grunt.registerTask('build', ['zip']);

};
