import java.util.Scanner;
import java.io.*;

public class Hello {
    public static void main(String[] args) {
        String line;
        Scanner scanner = new Scanner(System.in);
        File file = new File("input.txt");
        
        System.out.println("What is your name?");
        line = scanner.nextLine();
        System.out.println("Hello " + line);

        try{
            Scanner fileScanner = new Scanner(file);
            while(fileScanner.hasNextLine()) {
                System.out.println(fileScanner.nextLine());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

    }
}
