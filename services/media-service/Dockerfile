FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/media-service-*.jar app.jar
EXPOSE 8092
ENTRYPOINT ["java","-jar","/app/app.jar"]
