{
  "title": {
    "component": "",
    "description": ""
  },
  "description": {
    "problemStatement": "",
    "solutionOverview": "",
    "technicalApproach": ""
  },
  "changes": {
    "componentsAffected": {
      "sensorHardware": false,
      "mobileApp": false,
      "webDashboard": false,
      "backendServices": false,
      "analyticsEngine": false,
      "realtimeProcessing": false
    },
    "changeType": {
      "featureAddition": false,
      "bugFix": false,
      "performanceImprovement": false,
      "refactoring": false,
      "documentation": false,
      "configurationChange": false
    },
    "breakingChanges": {
      "hasBreakingChanges": false,
      "details": ""
    }
  },
  "testing": {
    "coverage": {
      "unitTests": false,
      "integrationTests": false,
      "e2eTests": false,
      "performanceTests": false,
      "securityTests": false
    },
    "environments": {
      "development": false,
      "staging": false,
      "production": false
    },
    "testResults": ""
  },
  "reviewChecklist": {
    "codeQuality": {
      "followsStyleGuidelines": false,
      "documentationUpdated": false,
      "testsPass": false
    },
    "security": {
      "authenticationReviewed": false,
      "encryptionRequirementsMet": false,
      "inputValidationImplemented": false
    },
    "performance": {
      "loadTestingCompleted": false,
      "resourceUtilizationMeasured": false,
      "scalabilityVerified": false
    },
    "other": {
      "breakingChangesDocumented": false,
      "databaseMigrationsIncluded": false,
      "apiChangesDocumented": false
    },
    "monitoring": {
      "errorTrackingImplemented": false,
      "performanceMetricsAdded": false,
      "alertsConfigured": false
    }
  },
  "metadata": {
    "labels": ["needs-review"],
    "componentLabels": [
      "component/sensor",
      "component/mobile",
      "component/web",
      "component/backend",
      "component/analytics"
    ],
    "requiredReviewers": 2,
    "reviewTeams": [
      "sensor-team",
      "mobile-team",
      "web-team",
      "backend-team",
      "analytics-team"
    ],
    "mergeRequirements": {
      "approvals": 2,
      "passingChecks": [
        "CI/CD Pipeline",
        "Security Scan",
        "Code Coverage",
        "Performance Tests"
      ]
    }
  },
  "additionalInformation": ""
}