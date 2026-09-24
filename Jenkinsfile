// Jenkins CI/CD for the ServeRest Playwright + TypeScript laboratory.
//
//   Feature branch : Install -> Quality -> Smoke
//   Pull request   : Install -> Quality -> Regression (smoke is a subset, not run separately)
//   main           : Install -> Quality -> Main Sanity -> Manual Deployment Authorization
//                    APPROVE -> Prepare Release -> Release Manifest -> Simulated SIT Deployment
//                               -> SIT Smoke (once) -> Simulated UAT Promotion -> Release Evidence
//                    REJECT  -> Release Evidence (releaseValidated=false, build SUCCESS)
//                    TIMEOUT -> native Jenkins interruption, build ABORTED
//
// Every deployment step is SIMULATED. This repository owns no SIT/UAT/production
// environment and deploys nothing; SIT Smoke runs against the public ServeRest
// reference services. Release logic lives in ci/release.mts (linted and type-checked).
//
// The CI image is pinned by tag and digest. Keep the two agent images and
// PLAYWRIGHT_IMAGE identical, and in step with @playwright/test in package.json.

pipeline {
  // No global agent: the authorization wait must not hold an executor or container.
  agent none

  options {
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timestamps()
  }

  environment {
    CI = 'true'
    PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27'
  }

  stages {
    stage('Verify') {
      agent {
        docker {
          image 'mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27'
          args '--ipc=host'
        }
      }
      options { timeout(time: 30, unit: 'MINUTES') }

      stages {
        stage('Install') {
          steps {
            // Workspaces are reused between builds: never publish a previous build's results.
            sh 'rm -rf reports playwright-report test-results'
            sh 'npm ci'
          }
        }

        stage('Quality') {
          steps {
            sh 'npm run quality'
          }
        }

        stage('Smoke') {
          when {
            allOf {
              not { changeRequest() }
              not { branch 'main' }
            }
          }
          steps {
            sh 'npm run test:smoke'
          }
        }

        stage('Regression') {
          when { changeRequest() }
          steps {
            sh 'npm run test:regression'
          }
        }

        // Fail-hard gate: a failure stops the build before any authorization or release stage.
        stage('Main Sanity') {
          when {
            allOf {
              branch 'main'
              not { changeRequest() }
            }
          }
          steps {
            sh 'npm run test:sanity'
          }
        }
      }

      post {
        always {
          junit testResults: 'reports/junit.xml', allowEmptyResults: true
          archiveArtifacts artifacts: 'playwright-report/**, test-results/**, reports/**', allowEmptyArchive: true
        }
      }
    }

    // No agent: nothing is held while waiting for a human.
    // Deliberately no try/catch: a timeout or an external abort propagates as Jenkins'
    // native interruption (build ABORTED) and is never interpreted as a rejection.
    stage('Manual Deployment Authorization') {
      agent none
      when {
        allOf {
          branch 'main'
          not { changeRequest() }
        }
      }
      steps {
        script {
          def decision = null
          def submitter = null
          timeout(time: 24, unit: 'HOURS') {
            def response = input(
              message: 'Main Sanity passed. Authorize the SIMULATED release (no real SIT/UAT environment exists)?',
              ok: 'Submit',
              parameters: [
                choice(name: 'DECISION', choices: ['APPROVE', 'REJECT'], description: 'APPROVE continues the simulated release; REJECT records evidence only.')
              ],
              submitterParameter: 'SUBMITTED_BY'
            )
            if (response instanceof Map) {
              decision = response.get('DECISION')
              submitter = response.get('SUBMITTED_BY')
            }
          }
          // Anything other than an explicit APPROVE fails safe toward "rejected".
          env.AUTHORIZATION_STATUS = (decision == 'APPROVE') ? 'approved' : 'rejected'
          env.AUTHORIZATION_SUBMITTER = submitter ?: ''
          echo "Deployment authorization: ${env.AUTHORIZATION_STATUS}"
        }
      }
    }

    stage('Release') {
      agent {
        docker {
          image 'mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27'
          args '--ipc=host'
        }
      }
      when {
        allOf {
          branch 'main'
          not { changeRequest() }
        }
      }
      options { timeout(time: 30, unit: 'MINUTES') }

      stages {
        // Runs for APPROVE and REJECT: resets release-evidence/ and records the decision.
        stage('Record Authorization') {
          steps {
            sh 'node ci/release.mts authorization'
          }
        }

        stage('Prepare Release') {
          when { environment name: 'AUTHORIZATION_STATUS', value: 'approved' }
          steps {
            sh '''
              set -eu
              test "$(git -c safe.directory="$PWD" rev-parse HEAD)" = "$GIT_COMMIT"
              git -c safe.directory="$PWD" archive --format=tar.gz -o release-evidence/release-candidate.tar.gz "$GIT_COMMIT"
              npm ci
            '''
          }
        }

        stage('Release Manifest') {
          when { environment name: 'AUTHORIZATION_STATUS', value: 'approved' }
          steps {
            sh 'node ci/release.mts manifest'
          }
        }

        stage('Simulated SIT Deployment') {
          when { environment name: 'AUTHORIZATION_STATUS', value: 'approved' }
          steps {
            sh 'node ci/release.mts sit-deploy'
          }
        }

        // Runs the smoke suite exactly once, against the public ServeRest reference target.
        // A failure fails the build but still lets Release Evidence record it.
        stage('SIT Smoke') {
          when { environment name: 'AUTHORIZATION_STATUS', value: 'approved' }
          steps {
            catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
              sh '''
                set +e
                PLAYWRIGHT_HTML_OUTPUT_DIR=release-evidence/sit-smoke/playwright-report \
                PLAYWRIGHT_JUNIT_OUTPUT_FILE=release-evidence/sit-smoke/junit.xml \
                  npm run test:smoke -- --output=release-evidence/sit-smoke/test-results
                rc=$?
                node ci/release.mts sit-smoke-result "$rc" || exit 1
                exit "$rc"
              '''
            }
          }
          // Only this stage produces Release test results, so a REJECT build publishes no empty
          // report; here a missing JUnit file is an error, not an empty result.
          post {
            always {
              junit testResults: 'release-evidence/sit-smoke/junit.xml', allowEmptyResults: false
            }
          }
        }

        // Evidence only: no second smoke run and no UAT endpoint.
        stage('Simulated UAT Promotion') {
          when {
            allOf {
              environment name: 'AUTHORIZATION_STATUS', value: 'approved'
              expression { fileExists('release-evidence/sit-smoke.passed') }
            }
          }
          steps {
            sh 'node ci/release.mts uat-promote'
          }
        }

        stage('Release Evidence') {
          steps {
            sh 'node ci/release.mts evidence'
          }
        }
      }

      post {
        always {
          archiveArtifacts artifacts: 'release-evidence/**', allowEmptyArchive: true
        }
      }
    }
  }
}
