export abstract class DomainException extends Error {
    protected constructor(
        message: string,
        public readonly code: string,
    ) {
        super(message);

        this.name = new.target.name;

        Object.setPrototypeOf(this, new.target.prototype);
    }
}