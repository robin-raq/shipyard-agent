import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Shipyard API',
      version: '1.0.0',
      description: 'API documentation for Shipyard - a project management and documentation platform',
      contact: {
        name: 'Shipyard Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        // Common schemas
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Resource not found',
            },
            status: {
              type: 'integer',
              example: 404,
            },
          },
        },
        Timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-15T10:30:00.000Z',
        },
        UUID: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },

        // Doc schemas
        Doc: {
          type: 'object',
          properties: {
            id: { $ref: '#/components/schemas/UUID' },
            title: {
              type: 'string',
              example: 'API Documentation',
            },
            content: {
              type: 'string',
              example: 'This is the content of the document...',
            },
            created_at: { $ref: '#/components/schemas/Timestamp' },
            updated_at: { $ref: '#/components/schemas/Timestamp' },
            deleted_at: {
              oneOf: [
                { $ref: '#/components/schemas/Timestamp' },
                { type: 'null' },
              ],
            },
          },
        },
        DocCreate: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              example: 'API Documentation',
            },
            content: {
              type: 'string',
              example: 'This is the content of the document...',
              default: '',
            },
          },
        },
        DocUpdate: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              example: 'Updated API Documentation',
            },
            content: {
              type: 'string',
              example: 'Updated content...',
            },
          },
        },

        // Issue schemas
        Issue: {
          type: 'object',
          properties: {
            id: { $ref: '#/components/schemas/UUID' },
            title: {
              type: 'string',
              example: 'Fix login bug',
            },
            content: {
              type: 'string',
              example: 'Users cannot log in with special characters in password',
            },
            status: {
              type: 'string',
              enum: ['open', 'in_progress', 'done', 'closed'],
              example: 'open',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              example: 'medium',
            },
            project_id: {
              oneOf: [
                { $ref: '#/components/schemas/UUID' },
                { type: 'null' },
              ],
            },
            created_at: { $ref: '#/components/schemas/Timestamp' },
            updated_at: { $ref: '#/components/schemas/Timestamp' },
            deleted_at: {
              oneOf: [
                { $ref: '#/components/schemas/Timestamp' },
                { type: 'null' },
              ],
            },
          },
        },
        IssueCreate: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              example: 'Fix login bug',
            },
            content: {
              type: 'string',
              example: 'Users cannot log in with special characters in password',
              default: '',
            },
            status: {
              type: 'string',
              enum: ['open', 'in_progress', 'done', 'closed'],
              default: 'open',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              default: 'medium',
            },
          },
        },
        IssueUpdate: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              example: 'Fix login bug - Updated',
            },
            content: {
              type: 'string',
              example: 'Updated description...',
            },
            status: {
              type: 'string',
              enum: ['open', 'in_progress', 'done', 'closed'],
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
            },
          },
        },

        // Project schemas
        Project: {
          type: 'object',
          properties: {
            id: { $ref: '#/components/schemas/UUID' },
            title: {
              type: 'string',
              example: 'Website Redesign',
            },
            description: {
              type: 'string',
              example: 'Complete redesign of the company website',
            },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'archived'],
              example: 'active',
            },
            created_at: { $ref: '#/components/schemas/Timestamp' },
            updated_at: { $ref: '#/components/schemas/Timestamp' },
            deleted_at: {
              oneOf: [
                { $ref: '#/components/schemas/Timestamp' },
                { type: 'null' },
              ],
            },
          },
        },
        ProjectCreate: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              example: 'Website Redesign',
            },
            description: {
              type: 'string',
              example: 'Complete redesign of the company website',
              default: '',
            },
          },
        },
        ProjectUpdate: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              example: 'Website Redesign - Phase 2',
            },
            description: {
              type: 'string',
              example: 'Updated description...',
            },
          },
        },

        // Week schemas
        Week: {
          type: 'object',
          properties: {
            id: { $ref: '#/components/schemas/UUID' },
            title: {
              type: 'string',
              example: 'Week of Jan 15, 2024',
            },
            content: {
              type: 'string',
              example: 'This week we focused on...',
            },
            start_date: {
              oneOf: [
                { type: 'string', format: 'date', example: '2024-01-15' },
                { type: 'null' },
              ],
            },
            end_date: {
              oneOf: [
                { type: 'string', format: 'date', example: '2024-01-21' },
                { type: 'null' },
              ],
            },
            created_at: { $ref: '#/components/schemas/Timestamp' },
            updated_at: { $ref: '#/components/schemas/Timestamp' },
            deleted_at: {
              oneOf: [
                { $ref: '#/components/schemas/Timestamp' },
                { type: 'null' },
              ],
            },
          },
        },
        WeekCreate: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              example: 'Week of Jan 15, 2024',
            },
            content: {
              type: 'string',
              example: 'This week we focused on...',
              default: '',
            },
          },
        },
        WeekUpdate: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              example: 'Week of Jan 15, 2024 - Updated',
            },
            content: {
              type: 'string',
              example: 'Updated content...',
            },
          },
        },

        // Team schemas
        Team: {
          type: 'object',
          properties: {
            id: { $ref: '#/components/schemas/UUID' },
            name: {
              type: 'string',
              example: 'Engineering Team',
            },
            description: {
              type: 'string',
              example: 'Core engineering team responsible for product development',
            },
            created_at: { $ref: '#/components/schemas/Timestamp' },
            updated_at: { $ref: '#/components/schemas/Timestamp' },
            deleted_at: {
              oneOf: [
                { $ref: '#/components/schemas/Timestamp' },
                { type: 'null' },
              ],
            },
          },
        },
        TeamCreate: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              example: 'Engineering Team',
            },
            description: {
              type: 'string',
              example: 'Core engineering team responsible for product development',
              default: '',
            },
          },
        },
        TeamUpdate: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Senior Engineering Team',
            },
            description: {
              type: 'string',
              example: 'Updated description...',
            },
          },
        },

        // Ship schemas
        Ship: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'USS Enterprise',
            },
            description: {
              oneOf: [
                { type: 'string', example: 'A legendary starship' },
                { type: 'null' },
              ],
            },
            status: {
              type: 'string',
              example: 'active',
            },
            created_at: { $ref: '#/components/schemas/Timestamp' },
            updated_at: { $ref: '#/components/schemas/Timestamp' },
            deleted_at: {
              oneOf: [
                { $ref: '#/components/schemas/Timestamp' },
                { type: 'null' },
              ],
            },
          },
        },
        ShipCreate: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              example: 'USS Enterprise',
            },
            description: {
              type: 'string',
              example: 'A legendary starship',
            },
            status: {
              type: 'string',
              example: 'active',
              default: 'active',
            },
          },
        },
        ShipUpdate: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'USS Enterprise-D',
            },
            description: {
              type: 'string',
              example: 'Updated description...',
            },
            status: {
              type: 'string',
              example: 'inactive',
            },
          },
        },
      },
      parameters: {
        IdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Resource ID',
          schema: {
            type: 'string',
          },
        },
        StatusQuery: {
          name: 'status',
          in: 'query',
          required: false,
          description: 'Filter by status',
          schema: {
            type: 'string',
            enum: ['open', 'in_progress', 'done', 'closed'],
          },
        },
        PriorityQuery: {
          name: 'priority',
          in: 'query',
          required: false,
          description: 'Filter by priority',
          schema: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
          },
        },
      },
      responses: {
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: true,
                message: 'Resource not found',
                status: 404,
              },
            },
          },
        },
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: true,
                message: 'Invalid input',
                status: 400,
              },
            },
          },
        },
        InternalError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: true,
                message: 'Internal server error',
                status: 500,
              },
            },
          },
        },
      },
    },
    paths: {
      // Docs endpoints
      '/docs': {
        get: {
          tags: ['Docs'],
          summary: 'List all docs',
          description: 'Retrieve a list of all non-deleted docs',
          responses: {
            '200': {
              description: 'List of docs',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Doc' },
                  },
                },
              },
            },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Docs'],
          summary: 'Create a new doc',
          description: 'Create a new document',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DocCreate' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Doc created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Doc' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/docs/{id}': {
        get: {
          tags: ['Docs'],
          summary: 'Get a doc by ID',
          description: 'Retrieve a single doc by its ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Doc found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Doc' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        put: {
          tags: ['Docs'],
          summary: 'Update a doc',
          description: 'Update an existing doc by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DocUpdate' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Doc updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Doc' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        delete: {
          tags: ['Docs'],
          summary: 'Delete a doc',
          description: 'Soft delete a doc by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Doc deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Doc' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      // Issues endpoints
      '/issues': {
        get: {
          tags: ['Issues'],
          summary: 'List all issues',
          description: 'Retrieve a list of all non-deleted issues with optional filters',
          parameters: [
            { $ref: '#/components/parameters/StatusQuery' },
            { $ref: '#/components/parameters/PriorityQuery' },
          ],
          responses: {
            '200': {
              description: 'List of issues',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Issue' },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Issues'],
          summary: 'Create a new issue',
          description: 'Create a new issue',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IssueCreate' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Issue created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Issue' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/issues/{id}': {
        get: {
          tags: ['Issues'],
          summary: 'Get an issue by ID',
          description: 'Retrieve a single issue by its ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Issue found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Issue' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        put: {
          tags: ['Issues'],
          summary: 'Update an issue',
          description: 'Update an existing issue by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IssueUpdate' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Issue updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Issue' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        delete: {
          tags: ['Issues'],
          summary: 'Delete an issue',
          description: 'Soft delete an issue by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Issue deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Issue' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      // Projects endpoints
      '/projects': {
        get: {
          tags: ['Projects'],
          summary: 'List all projects',
          description: 'Retrieve a list of all non-deleted projects',
          responses: {
            '200': {
              description: 'List of projects',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Project' },
                  },
                },
              },
            },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Projects'],
          summary: 'Create a new project',
          description: 'Create a new project',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProjectCreate' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Project created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Project' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/projects/{id}': {
        get: {
          tags: ['Projects'],
          summary: 'Get a project by ID',
          description: 'Retrieve a single project by its ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Project found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Project' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        put: {
          tags: ['Projects'],
          summary: 'Update a project',
          description: 'Update an existing project by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProjectUpdate' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Project updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Project' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        delete: {
          tags: ['Projects'],
          summary: 'Delete a project',
          description: 'Soft delete a project by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Project deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Project' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      // Weeks endpoints
      '/weeks': {
        get: {
          tags: ['Weeks'],
          summary: 'List all weeks',
          description: 'Retrieve a list of all non-deleted weeks',
          responses: {
            '200': {
              description: 'List of weeks',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Week' },
                  },
                },
              },
            },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Weeks'],
          summary: 'Create a new week',
          description: 'Create a new week entry',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WeekCreate' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Week created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Week' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/weeks/{id}': {
        get: {
          tags: ['Weeks'],
          summary: 'Get a week by ID',
          description: 'Retrieve a single week by its ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Week found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Week' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        put: {
          tags: ['Weeks'],
          summary: 'Update a week',
          description: 'Update an existing week by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WeekUpdate' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Week updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Week' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        delete: {
          tags: ['Weeks'],
          summary: 'Delete a week',
          description: 'Soft delete a week by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Week deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Week' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      // Teams endpoints
      '/teams': {
        get: {
          tags: ['Teams'],
          summary: 'List all teams',
          description: 'Retrieve a list of all non-deleted teams',
          responses: {
            '200': {
              description: 'List of teams',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Team' },
                  },
                },
              },
            },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Teams'],
          summary: 'Create a new team',
          description: 'Create a new team',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TeamCreate' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Team created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Team' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/teams/{id}': {
        get: {
          tags: ['Teams'],
          summary: 'Get a team by ID',
          description: 'Retrieve a single team by its ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Team found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Team' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        put: {
          tags: ['Teams'],
          summary: 'Update a team',
          description: 'Update an existing team by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TeamUpdate' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Team updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Team' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        delete: {
          tags: ['Teams'],
          summary: 'Delete a team',
          description: 'Soft delete a team by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Team deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Team' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },

      // Ships endpoints
      '/ships': {
        get: {
          tags: ['Ships'],
          summary: 'List all ships',
          description: 'Retrieve a list of all non-deleted ships',
          responses: {
            '200': {
              description: 'List of ships',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Ship' },
                  },
                },
              },
            },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        post: {
          tags: ['Ships'],
          summary: 'Create a new ship',
          description: 'Create a new ship',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ShipCreate' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Ship created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Ship' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/ships/{id}': {
        get: {
          tags: ['Ships'],
          summary: 'Get a ship by ID',
          description: 'Retrieve a single ship by its ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Ship found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Ship' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        put: {
          tags: ['Ships'],
          summary: 'Update a ship',
          description: 'Update an existing ship by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ShipUpdate' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Ship updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Ship' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
        delete: {
          tags: ['Ships'],
          summary: 'Delete a ship',
          description: 'Soft delete a ship by ID',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Ship deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Ship' },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
    },
    tags: [
      {
        name: 'Docs',
        description: 'Documentation management endpoints',
      },
      {
        name: 'Issues',
        description: 'Issue tracking endpoints',
      },
      {
        name: 'Projects',
        description: 'Project management endpoints',
      },
      {
        name: 'Weeks',
        description: 'Weekly update endpoints',
      },
      {
        name: 'Teams',
        description: 'Team management endpoints',
      },
      {
        name: 'Ships',
        description: 'Ship management endpoints',
      },
    ],
  },
  apis: [], // We're using the definition object directly instead of JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
