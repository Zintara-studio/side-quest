package com.sidequest.arena.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI document metadata + bearer-JWT security scheme for the Swagger UI at {@code /v1/docs}. */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI sideQuestOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Side Quest League API")
                        .version("v1")
                        .description("REST API for the Side Quest esports league platform — players, "
                                + "franchises, games, matches, registrations, standings, announcements, "
                                + "realtime and admin. Implements the Side Quest Backend Architecture.")
                        .license(new License().name("Proprietary")))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
