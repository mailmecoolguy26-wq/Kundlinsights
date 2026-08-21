# AWS Production Foundation

## Current state

The manually provisioned AWS foundation for KundlInsights is in `ap-south-1` (Asia Pacific — Mumbai). It is **foundation only**: no production backend, public API URL, container image, ECS task definition, ECS service, Application Load Balancer (ALB), target group, or WAF exists yet.

| Resource | Current state |
| --- | --- |
| Private ECR repository | `kundlinsights-backend` — created; no approved production image pushed |
| ECS cluster | `kundlinsights-production` — created for Fargate |
| ECS service-linked role | `AWSServiceRoleForECS` — created |
| ECS execution role | `kundlinsights-ecs-execution-role` — created |
| ECS application task role | `kundlinsights-ecs-task-role` — created; no broad application permissions |
| Secrets Manager secret | `kundlinsights/production/openai` — created; supplies `OPENAI_API_KEY` later |
| CloudWatch log group | `/ecs/kundlinsights-backend` — created; 14-day retention |

## IAM responsibilities

`kundlinsights-ecs-execution-role` is used by ECS/Fargate to pull private ECR images, deliver logs to CloudWatch, and retrieve explicitly approved Secrets Manager values. Its current policies are `AmazonECSTaskExecutionRolePolicy` and the inline `KundlInsightsOpenAISecretAccess` policy.

`kundlinsights-ecs-task-role` is for application-level AWS API permissions. It currently has no broad permissions. When production KMS is finalized, grant only the least-privilege KMS permissions required by the application.

## Runtime configuration and security boundary

`OPENAI_API_KEY` will be injected from `kundlinsights/production/openai`; its value is not stored in Git. AWS credentials, access keys, passwords, session tokens, and private keys are not stored in Git. This repository documents secret names only.

`OPENAI_CAREER_MODEL` and `OPENAI_CAREER_TIMEOUT_MS` will be non-secret ECS environment variables. The current intended timeout is `15000`; no model name is made an architectural requirement here.

Future ECS tasks should use `awslogs` with `/ecs/kundlinsights-backend` and the existing 14-day retention policy.

## Production astronomy boundary

Development and testing may continue with the provisional/reference `AstronomyEngineProvider`. Commercial production must not silently use that provider. Before commercial deployment, obtain the Swiss Ephemeris Professional License, activate Swiss production authority, verify approved ephemeris artifacts and their manifest, finalize the production bootstrap, and validate the Docker image.

## CAREER-P8F

**CAREER-P8F controlled production smoke test: DEFERRED.** No live production backend exists yet; this status is neither pass nor fail.

## Remaining deployment sequence

1. Continue product development.
2. Acquire the Swiss commercial license near launch.
3. Activate Swiss production authority.
4. Finalize the production bootstrap.
5. Dockerize the backend.
6. Push an approved container image to ECR.
7. Configure production KMS and least-privilege task permissions.
8. Create the ECS task definition.
9. Create the ECS service.
10. Create the ALB and target group.
11. Configure HTTPS.
12. Add WAF if required.
13. Deploy the backend.
14. Configure OpenAI runtime variables.
15. Run CAREER-P8F.
16. Connect the production API to Flutter.
17. Launch.
