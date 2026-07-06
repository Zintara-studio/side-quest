# syntax=docker/dockerfile:1

# ---------- build stage ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cache dependencies first (only re-runs when pom.xml changes)
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

# Build the executable jar
COPY src ./src
RUN mvn -B -q -DskipTests clean package

# ---------- runtime stage ----------
FROM eclipse-temurin:21-jre

# curl is required by the container HEALTHCHECK below (the temurin JRE image ships neither curl nor wget).
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces run containers as uid 1000. Use a workdir owned by that uid (the base image
# already reserves uid 1000, so we don't create a user — just run as it).
WORKDIR /app
COPY --from=build /build/target/sidequest-backend.jar /app/app.jar
RUN chown -R 1000:1000 /app

# Dev profile = in-memory H2 + seeded demo league (no external services required).
ENV HOME=/app \
    SPRING_PROFILES_ACTIVE=dev \
    SERVER_PORT=8080 \
    JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080
USER 1000

# Container-friendly health check hits the actuator endpoint (under the /v1 context path).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8080/v1/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
