# Code Validation Framework

This document defines how we validate code quality across multiple essential roles. Every piece of code must pass validation from all perspectives before merging.

## Core Principles

These principles are non-negotiable and apply to all validation roles:

1. **Maintainability**: Code must be easy to understand, modify, and extend
2. **Modularity**: Clear boundaries, single responsibilities, minimal coupling
3. **Functional Paradigm**: Prefer pure functions, immutability, and explicit data flow
4. **Testability**: Code must be testable in isolation with clear contracts
5. **Documentation**: Intent, constraints, and usage must be clear

---

## Validation Roles

### 1. Architect Role
**Focus**: System structure, boundaries, and long-term evolution

**Validation Checklist**:
- [ ] **Separation of concerns**: Each module has one clear responsibility
- [ ] **Dependency direction**: Dependencies flow inward (infrastructure → domain)
- [ ] **Interface contracts**: Clear, stable interfaces between modules
- [ ] **Extension points**: New features can be added without modifying existing code
- [ ] **No circular dependencies**: Module dependency graph is a DAG
- [ ] **Appropriate abstraction level**: Not over-engineered, not under-abstracted
- [ ] **Technology isolation**: External libraries/frameworks are wrapped behind our interfaces

**Questions to ask**:
- Can I add a new job board without touching existing adapters?
- If I remove this module, what breaks? (Should be minimal)
- Are the boundaries between modules explicit and enforced?
- Would a new team member understand the structure in 10 minutes?

**Red flags**:
- God objects or functions doing multiple things
- Circular imports between modules
- Business logic in infrastructure code
- Framework-specific patterns leaking into domain logic

---

### 2. Developer Role
**Focus**: Implementation quality, correctness, and developer experience

**Validation Checklist**:
- [ ] **Type safety**: TypeScript strict mode, no `any` types without justification
- [ ] **Error handling**: All errors are caught, logged, and handled appropriately
- [ ] **Edge cases**: Boundary conditions and failure modes are handled
- [ ] **Naming**: Variables, functions, and types have clear, descriptive names
- [ ] **Code duplication**: No copy-paste code (DRY principle)
- [ ] **Complexity**: Functions are small (<50 lines), do one thing
- [ ] **Comments**: Complex logic is explained; obvious code is not commented
- [ ] **Async handling**: Promises are properly awaited, errors are caught

**Questions to ask**:
- Can I understand what this function does without reading the implementation?
- What happens if this external service fails?
- Are there any hidden side effects?
- Is the happy path clear and the error paths explicit?

**Red flags**:
- Functions longer than 50 lines
- Deep nesting (>3 levels)
- Magic numbers or strings
- Catching errors and not handling them
- Callback hell or promise chains without async/await

---

### 3. Tester Role
**Focus**: Testability, coverage, and confidence in correctness

**Validation Checklist**:
- [ ] **Unit tests**: All public functions have unit tests
- [ ] **Integration tests**: Module interactions are tested
- [ ] **Edge cases**: Tests cover boundary conditions and error paths
- [ ] **Test isolation**: Tests don't depend on each other or external state
- [ ] **Test clarity**: Test names describe behavior, not implementation
- [ ] **Mocking strategy**: External dependencies are mocked appropriately
- [ ] **Coverage**: Critical paths have >80% coverage
- [ ] **Test speed**: Unit tests run in <1 second each

**Questions to ask**:
- If I change this code, will the tests catch bugs?
- Are the tests testing behavior or implementation details?
- Can I run tests in parallel without conflicts?
- Do tests fail with clear, actionable messages?

**Red flags**:
- Tests that depend on network, database, or file system without mocks
- Tests that only test the happy path
- Tests that are slow or flaky
- Test names like "test1", "test2", or that describe implementation

---

### 4. Security Specialist Role
**Focus**: Vulnerabilities, data protection, and secure practices

**Validation Checklist**:
- [ ] **Input validation**: All external input is validated and sanitized
- [ ] **Authentication**: Sensitive operations require proper auth
- [ ] **Authorization**: Users can only access their own data
- [ ] **Secrets management**: No hardcoded credentials, API keys, or tokens
- [ ] **Logging**: Sensitive data is not logged (passwords, tokens, PII)
- [ ] **Error messages**: Errors don't leak internal details to users
- [ ] **Dependencies**: No known vulnerabilities in dependencies
- [ ] **Rate limiting**: APIs protect against abuse

**Questions to ask**:
- What happens if a malicious user sends unexpected input?
- Can someone access data they shouldn't?
- Are secrets properly rotated and stored?
- Would this code pass a security audit?

**Red flags**:
- SQL injection vulnerabilities
- Storing passwords in plain text
- Logging sensitive information
- Hardcoded credentials
- Missing input validation
- Overly permissive CORS

---

### 5. Performance Engineer Role
**Focus**: Efficiency, scalability, and resource usage

**Validation Checklist**:
- [ ] **Algorithmic complexity**: No O(n²) when O(n log n) is possible
- [ ] **Database queries**: Queries are indexed, no N+1 problems
- [ ] **Caching**: Expensive operations are cached where appropriate
- [ ] **Memory usage**: No memory leaks, large objects are released
- [ ] **Concurrency**: Async operations don't block the event loop
- [ ] **Batching**: Multiple operations are batched when possible
- [ ] **Lazy loading**: Data is loaded only when needed
- [ ] **Monitoring**: Performance-critical paths have metrics

**Questions to ask**:
- How does this perform with 10x the current data?
- Are there any blocking operations in hot paths?
- Can this be parallelized?
- What's the memory footprint?

**Red flags**:
- Synchronous file I/O in request handlers
- Unbounded queries (no LIMIT)
- Loading entire datasets into memory
- Missing database indexes
- Sequential operations that could be parallel

---

### 6. Maintainer Role
**Focus**: Long-term sustainability and operational concerns

**Validation Checklist**:
- [ ] **Documentation**: README, API docs, and inline comments are current
- [ ] **Logging**: Operations are logged with appropriate levels
- [ ] **Monitoring**: Health checks and metrics are exposed
- [ ] **Configuration**: Behavior can be changed without code changes
- [ ] **Deployment**: Code can be deployed without downtime
- [ ] **Rollback**: Failed deployments can be rolled back safely
- [ ] **Dependencies**: Dependencies are up-to-date and necessary
- [ ] **Deprecation**: Old code is marked for removal with migration path

**Questions to ask**:
- Can I debug this in production at 3 AM?
- How do I know if this is working correctly?
- What happens if this service goes down?
- How do I migrate data if the schema changes?

**Red flags**:
- No logging in critical paths
- Missing health checks
- Hardcoded configuration values
- No way to feature-flag new code
- Missing metrics for key operations

---

## Validation Process

### For New Features

1. **Design review** (Architect role)
   - Review the design before writing code
   - Ensure it fits the system architecture
   - Identify extension points and boundaries

2. **Implementation** (Developer role)
   - Write code following the checklist
   - Keep functions small and focused
   - Handle errors explicitly

3. **Testing** (Tester role)
   - Write tests alongside code (TDD preferred)
   - Cover happy path, edge cases, and error paths
   - Ensure tests are fast and isolated

4. **Security review** (Security Specialist role)
   - Review for vulnerabilities
   - Validate input handling
   - Check for data leaks

5. **Performance review** (Performance Engineer role)
   - Profile critical paths
   - Check database query plans
   - Load test if applicable

6. **Documentation** (Maintainer role)
   - Update README and API docs
   - Add inline comments for complex logic
   - Update monitoring and logging

### For Bug Fixes

1. **Reproduce** (Tester role)
   - Write a failing test that reproduces the bug
   - Ensure the test is minimal and clear

2. **Root cause** (Developer role)
   - Identify the root cause, not just symptoms
   - Check for similar issues elsewhere

3. **Fix** (Developer role)
   - Fix the bug with minimal changes
   - Ensure the fix doesn't introduce new issues

4. **Verify** (Tester role)
   - Ensure the failing test now passes
   - Run full test suite to check for regressions

5. **Prevent** (Maintainer role)
   - Add monitoring to catch similar issues
   - Update documentation if needed

---

## Validation Tools

### Automated Checks

```bash
# Type checking
npm run build

# Linting
npm run lint

# Testing
npm test
npm run test:coverage

# Security
npm audit

# Dependencies
npm outdated
```

### Manual Review

- Code review by at least one other person
- Walk through the validation checklists
- Ask "what if" questions for each role
- Document any trade-offs or decisions

---

## Example: Validating the Adapter Infrastructure

Let's apply this framework to our recent adapter work:

### Architect Validation ✅
- ✅ Clear separation: `BoardAdapter` interface defines contract
- ✅ Registry pattern allows adding boards without modifying core
- ✅ Adapters are isolated - failure in one doesn't affect others
- ✅ Dependencies flow correctly: adapters depend on shared types

### Developer Validation ✅
- ✅ Type-safe: Full TypeScript with strict mode
- ✅ Error handling: Adapters can fail independently
- ✅ Naming: Clear names (`fetchJobs`, `searchJobs`, `healthCheck`)
- ✅ Small functions: Each method has single responsibility

### Tester Validation ⚠️
- ✅ MockAdapter allows testing without real boards
- ⚠️ Need more tests for AdapterRegistry
- ⚠️ Need integration tests with MockAdapter
- **Action**: Add tests for registry operations

### Security Validation ✅
- ✅ No hardcoded credentials
- ✅ Input validation in search queries
- ✅ Errors are logged but not leaked
- **Note**: Real adapters will need API key management

### Performance Validation ✅
- ✅ Async operations don't block
- ✅ Can fetch from multiple boards in parallel
- ⚠️ Need to add rate limiting in real adapters
- **Action**: Add rate limiting to AdapterConfig

### Maintainer Validation ⚠️
- ✅ Logging in registry operations
- ⚠️ Need health check endpoint in API
- ⚠️ Need metrics for adapter success/failure rates
- **Action**: Add monitoring dashboard

---

## Continuous Improvement

This validation framework is a living document. Update it when:
- You discover a new category of issues
- A validation step is consistently skipped
- The team grows and needs more guidance
- Technology or requirements change

**Last updated**: 2026-07-23
**Next review**: When we implement the first real adapter
