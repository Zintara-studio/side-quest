FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/community-service-*.jar app.jar
EXPOSE 8091
ENTRYPOINT ["java","-jar","/app/app.jar"]
