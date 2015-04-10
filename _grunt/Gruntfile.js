module.exports = function (grunt) {
  grunt.initConfig({
    bower: {
      install: {
        options: {
          targetDir: "../resources/lib",
          cleanup: true,
          layout: "byComponent",
          verbose: true
        }
      }
    }
  });
  
  grunt.loadNpmTasks('grunt-bower-task');

  grunt.registerTask('default', ['bower:install']);
};
