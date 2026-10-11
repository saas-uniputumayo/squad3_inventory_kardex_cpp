import * as fs from 'fs';
import * as path from 'path';

describe('Hexagonal Architecture Verification Tests', () => {
    const srcDir = path.resolve(__dirname, '../../src');

    function getAllTsFiles(dirPath: string): string[] {
        let results: string[] = [];
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                results = results.concat(getAllTsFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                results.push(fullPath);
            }
        }
        return results;
    }

    it('Test 1: Application layer NEVER imports Infrastructure', () => {
        const appFiles = getAllTsFiles(path.join(srcDir, 'application'));
        const violations: string[] = [];

        const prohibitedPatterns = [
            /from\s+['"].*infrastructure.*['"]/,
            /from\s+['"]@prisma\/client['"]/,
            /from\s+['"]ioredis['"]/,
            /from\s+['"]express['"]/,
        ];

        for (const file of appFiles) {
            const content = fs.readFileSync(file, 'utf-8');
            for (const pattern of prohibitedPatterns) {
                if (pattern.test(content)) {
                    violations.push(`${file} matches ${pattern}`);
                }
            }
        }

        expect(violations).toEqual([]);
    });

    it('Test 2: Presentation layer NEVER imports Infrastructure', () => {
        const presFiles = getAllTsFiles(path.join(srcDir, 'presentation'));
        const violations: string[] = [];

        const prohibitedPatterns = [
            /from\s+['"].*infrastructure.*['"]/,
            /from\s+['"]@prisma\/client['"]/,
            /from\s+['"]ioredis['"]/,
            /PrismaService/,
            /PrismaClient/,
        ];

        for (const file of presFiles) {
            const content = fs.readFileSync(file, 'utf-8');
            for (const pattern of prohibitedPatterns) {
                if (pattern.test(content)) {
                    violations.push(`${file} matches ${pattern}`);
                }
            }
        }

        expect(violations).toEqual([]);
    });

    it('Test 3: Domain layer NEVER imports outer layers or frameworks', () => {
        const domainFiles = getAllTsFiles(path.join(srcDir, 'domain'));
        const violations: string[] = [];

        const prohibitedPatterns = [
            /from\s+['"].*application.*['"]/,
            /from\s+['"].*infrastructure.*['"]/,
            /from\s+['"].*presentation.*['"]/,
            /from\s+['"]@nestjs\/.*['"]/,
            /from\s+['"]@prisma\/.*['"]/,
            /from\s+['"]ioredis['"]/,
            /from\s+['"]express['"]/,
        ];

        for (const file of domainFiles) {
            const content = fs.readFileSync(file, 'utf-8');
            for (const pattern of prohibitedPatterns) {
                if (pattern.test(content)) {
                    violations.push(`${file} matches ${pattern}`);
                }
            }
        }

        expect(violations).toEqual([]);
    });
});
