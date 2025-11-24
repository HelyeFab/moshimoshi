/**
 * ESLint Rules for Dual Storage Enforcement
 * Prevents direct Firebase writes without storage helper checks
 */

module.exports = {
  rules: {
    'no-direct-firebase-writes': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Prevent direct Firebase writes without storage helper',
          category: 'Best Practices',
          recommended: true
        },
        messages: {
          directFirebaseWrite: 'Direct Firebase write detected. Use storage-helper or storage-guard middleware instead.',
          missingStorageCheck: 'Firebase operation without getStorageDecision() check detected.',
          useStorageHelper: 'Import and use getStorageDecision() from @/lib/api/storage-helper before Firebase operations.'
        },
        fixable: 'code'
      },

      create(context) {
        let hasStorageHelper = false
        let hasStorageDecision = false
        let storageDecisionCalled = false

        return {
          // Check for storage helper import
          ImportDeclaration(node) {
            if (node.source.value === '@/lib/api/storage-helper') {
              hasStorageHelper = true
              const specifiers = node.specifiers
              specifiers.forEach(spec => {
                if (spec.imported && spec.imported.name === 'getStorageDecision') {
                  hasStorageDecision = true
                }
              })
            }
          },

          // Check for getStorageDecision calls
          CallExpression(node) {
            if (node.callee.name === 'getStorageDecision') {
              storageDecisionCalled = true
            }

            // Check for Firebase operations
            const isFirebaseOperation = checkFirebaseOperation(node)

            if (isFirebaseOperation && !isInAllowedFile(context)) {
              // Check if we're in a conditional that checks shouldWriteToFirebase
              const isProtected = isInProtectedBlock(node)

              if (!isProtected && !storageDecisionCalled) {
                context.report({
                  node,
                  messageId: 'directFirebaseWrite',
                  fix(fixer) {
                    // Suggest adding storage check
                    return fixer.insertTextBefore(
                      node,
                      'const decision = await getStorageDecision(session);\nif (decision.shouldWriteToFirebase) {\n'
                    )
                  }
                })
              }
            }
          },

          // Check member expressions for adminDb usage
          MemberExpression(node) {
            if (node.object.name === 'adminDb' && !isInAllowedFile(context)) {
              const parent = node.parent

              // Check if it's a write operation
              if (isWriteOperation(parent)) {
                const isProtected = isInProtectedBlock(node)

                if (!isProtected && !hasStorageHelper) {
                  context.report({
                    node,
                    messageId: 'useStorageHelper'
                  })
                }
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Check if a node represents a Firebase operation
 */
function checkFirebaseOperation(node) {
  if (!node.callee) return false

  const calleeName = getCalleeName(node.callee)

  // Check for Firebase write operations
  const firebaseWriteMethods = [
    'set',
    'update',
    'delete',
    'add',
    'create',
    'batch',
    'commit'
  ]

  return firebaseWriteMethods.some(method =>
    calleeName.includes(method)
  )
}

/**
 * Check if node is in a protected conditional block
 */
function isInProtectedBlock(node) {
  let parent = node.parent

  while (parent) {
    // Check for if statement with shouldWriteToFirebase
    if (parent.type === 'IfStatement') {
      const test = parent.test

      if (test && test.type === 'MemberExpression') {
        if (test.property && test.property.name === 'shouldWriteToFirebase') {
          return true
        }
      }

      // Check for storage decision checks
      if (test && test.type === 'Identifier' && test.name === 'isPremium') {
        return true
      }
    }

    // Check for conditional expression
    if (parent.type === 'ConditionalExpression') {
      const test = parent.test

      if (test && test.type === 'MemberExpression') {
        if (test.property && test.property.name === 'shouldWriteToFirebase') {
          return true
        }
      }
    }

    parent = parent.parent
  }

  return false
}

/**
 * Check if file is allowed to have direct Firebase writes
 */
function isInAllowedFile(context) {
  const filename = context.getFilename()

  const allowedFiles = [
    'storage-helper.ts',
    'storage-guard.ts',
    'firebase-tracker.ts',
    '.test.ts',
    '.test.tsx',
    'admin.ts'
  ]

  return allowedFiles.some(allowed => filename.includes(allowed))
}

/**
 * Check if operation is a write operation
 */
function isWriteOperation(node) {
  if (!node) return false

  if (node.type === 'CallExpression') {
    const method = node.callee.property

    if (method) {
      const writeMethod = ['set', 'update', 'delete', 'add', 'create']
      return writeMethod.includes(method.name)
    }
  }

  return false
}

/**
 * Get the full callee name from a call expression
 */
function getCalleeName(callee) {
  if (callee.type === 'Identifier') {
    return callee.name
  }

  if (callee.type === 'MemberExpression') {
    const object = getCalleeName(callee.object)
    const property = callee.property.name

    return `${object}.${property}`
  }

  return ''
}